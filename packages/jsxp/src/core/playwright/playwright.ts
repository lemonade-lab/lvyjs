import {
  chromium,
  type Browser,
  type BrowserContext,
  type LaunchOptions,
  type Page
} from 'playwright-core'
import os from 'os'
import { mkdir } from 'fs/promises'
import { dirname, isAbsolute, join } from 'path'
import type { BrowserEngine, PlaywrightPageHandler, RenderOptions } from '../../types.js'
import {
  createFileReadCache,
  getMissingBrowserError,
  readLocalResponse,
  resolveExecutablePath,
  shouldRestartBrowser,
  toBuffer
} from '../browser/shared.js'
import type { BrowserRenderer } from '../browser/types.js'
import type { LaunchOptions as PuppeteerLaunchOptions } from 'puppeteer-core'

type ContextPoolEntry = {
  key: string
  context: BrowserContext
  generation: number
  options: RenderOptions | undefined
}

type BoundingBox = { x: number; y: number; width: number; height: number }

const GIB = 1024 * 1024 * 1024
const RECOMMENDED_BYTES_PER_CONTEXT = 768 * 1024 * 1024

export class Playwright implements BrowserRenderer {
  #isBrowser = false
  #launch: PuppeteerLaunchOptions
  #startPromise: Promise<boolean> | null = null
  #fileReadCache = createFileReadCache()
  #contextPool: ContextPoolEntry[] = []
  #contextWaiters: Array<() => void> = []
  #checkedOutContexts = 0
  #browserGeneration = 0

  browser: Browser | null = null

  constructor(launch?: PuppeteerLaunchOptions) {
    this.#launch = launch ?? {}
  }

  getEngine(): BrowserEngine {
    return 'playwright'
  }

  #toLaunchOptions(executablePath: string | null): LaunchOptions {
    const launchOptions: LaunchOptions = {
      headless: typeof this.#launch.headless === 'boolean' ? this.#launch.headless : true,
      timeout: this.#launch.timeout,
      args: this.#launch.args
    }

    if (executablePath) {
      launchOptions.executablePath = executablePath
    }

    return launchOptions
  }

  #getMaxContextPoolSize(options: RenderOptions | undefined) {
    const override = options?.playwright?.maxContextPoolSize
    if (typeof override === 'number' && Number.isFinite(override)) {
      return clamp(Math.floor(override), 1, 16)
    }

    return calculateDynamicContextPoolSize()
  }

  async start() {
    try {
      const executablePath = resolveExecutablePath(this.#launch)
      const hasChannel =
        'channel' in this.#launch && Boolean((this.#launch as { channel?: string }).channel)

      if (!executablePath && !hasChannel) {
        throw getMissingBrowserError()
      }

      this.browser = await chromium.launch(this.#toLaunchOptions(executablePath))
      this.#isBrowser = true
      return true
    } catch (error) {
      this.#isBrowser = false
      console.warn('[browser] playwright start failed:', error)
      return false
    }
  }

  async isStart() {
    if (this.#isBrowser && this.browser?.isConnected()) {
      return true
    }

    if (this.#startPromise) return this.#startPromise
    this.#startPromise = this.#doRestart()
    try {
      return await this.#startPromise
    } finally {
      this.#startPromise = null
    }
  }

  async #doRestart() {
    await this.#drainContextPool()
    this.#isBrowser = false
    this.#browserGeneration++
    if (this.browser) {
      await this.browser.close().catch(() => {})
      this.browser = null
    }
    return this.start()
  }

  async #drainContextPool() {
    const entries = this.#contextPool.splice(0, this.#contextPool.length)
    await Promise.all(entries.map(entry => entry.context.close().catch(() => {})))
  }

  async #acquireContextSlot(options: RenderOptions | undefined) {
    const maxContextPoolSize = this.#getMaxContextPoolSize(options)
    if (this.#checkedOutContexts < maxContextPoolSize) {
      this.#checkedOutContexts++
      return
    }

    await new Promise<void>(resolve => {
      this.#contextWaiters.push(() => {
        this.#checkedOutContexts++
        resolve()
      })
    })
  }

  #releaseContextSlot() {
    this.#checkedOutContexts = Math.max(this.#checkedOutContexts - 1, 0)
    const waiter = this.#contextWaiters.shift()
    waiter?.()
  }

  #contextKey(options: RenderOptions | undefined) {
    return JSON.stringify(options?.playwright?.context ?? {})
  }

  #takePooledContext(key: string, generation: number) {
    for (let i = this.#contextPool.length - 1; i >= 0; i--) {
      const entry = this.#contextPool[i]
      if (entry.key !== key || entry.generation !== generation) {
        continue
      }
      this.#contextPool.splice(i, 1)
      return entry
    }
    return null
  }

  async #acquireContext(browser: Browser, options: RenderOptions | undefined) {
    await this.#acquireContextSlot(options)

    try {
      const key = this.#contextKey(options)
      const generation = this.#browserGeneration
      const pooled = this.#takePooledContext(key, generation)
      if (pooled) {
        pooled.options = options
        return pooled
      }

      const context = await browser.newContext(options?.playwright?.context)
      return { key, context, generation, options }
    } catch (error) {
      this.#releaseContextSlot()
      throw error
    }
  }

  async #releaseContext(entry: ContextPoolEntry) {
    try {
      const pages = entry.context.pages()
      await Promise.all(pages.map(page => page.close().catch(() => {})))

      if (entry.generation === this.#browserGeneration && this.browser?.isConnected()) {
        const maxContextPoolSize = this.#getMaxContextPoolSize(entry.options)
        if (this.#contextPool.length >= maxContextPoolSize) {
          await entry.context.close().catch(() => {})
        } else {
          this.#contextPool.push(entry)
        }
      } else {
        await entry.context.close().catch(() => {})
      }
    } catch {
      await entry.context.close().catch(() => {})
    } finally {
      this.#releaseContextSlot()
    }
  }

  #matchUrlPatterns(url: string, patterns: string[] | undefined) {
    if (!patterns || patterns.length === 0) return false
    return patterns.some(pattern => {
      const normalized = pattern.trim()
      if (!normalized) return false

      const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
      try {
        return new RegExp(`^${escaped}$`, 'i').test(url)
      } catch {
        return url.includes(normalized)
      }
    })
  }

  async #registerPage(page: Page, options: RenderOptions | undefined) {
    await page.route('**/*', async route => {
      const url = route.request().url()
      if (url.startsWith('jsxp://')) {
        const response = await readLocalResponse(url, this.#fileReadCache)
        await route.fulfill(response).catch(() => {})
        return
      }

      const network = options?.playwright?.network
      if (!network) {
        await route.continue().catch(() => {})
        return
      }

      if (this.#matchUrlPatterns(url, network.allowUrlPatterns)) {
        await route.continue().catch(() => {})
        return
      }

      const resourceType = route.request().resourceType()
      const blockedByType = Boolean(network.blockResourceTypes?.includes(resourceType as never))
      const blockedByPattern = this.#matchUrlPatterns(url, network.blockUrlPatterns)

      if (blockedByType || blockedByPattern) {
        await route.abort('blockedbyclient').catch(() => {})
        return
      }

      await route.continue().catch(() => {})
    })
  }

  async render(html: string, options?: RenderOptions) {
    return this.withPage(html, options, async page => {
      const { selector, screenshot, bufferFromEncoding, playwright } = options ?? {}
      const locator = page.locator(selector ?? 'body').first()

      const waitForSelectorTimeout = playwright?.waitForSelectorTimeout ?? gotoTimeout(options)
      await locator.waitFor({ state: 'visible', timeout: waitForSelectorTimeout })

      if (playwright?.waitForFonts !== false) {
        await page
          .evaluate(async () => {
            const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts
            if (fonts?.ready) {
              await fonts.ready
            }
          })
          .catch(() => {})
      }

      const stableFrames = Math.max(playwright?.waitForStableFrames ?? 2, 0)
      if (stableFrames > 1) {
        await waitForStableLocator(
          page,
          locator,
          stableFrames,
          playwright?.stableFrameIntervalMs ?? 50,
          waitForSelectorTimeout
        )
      }

      const buff = await locator.screenshot({
        type: 'png',
        ...((screenshot ?? {}) as Record<string, unknown>),
        ...((playwright?.locatorScreenshot ?? {}) as Record<string, unknown>)
      })
      console.info('[playwright-core] success')
      return toBuffer(buff, bufferFromEncoding)
    })
  }

  #resolveDiagnosticsPath(pathOrUndefined: string | undefined, defaultFileName: string) {
    const relativePath = pathOrUndefined && pathOrUndefined.trim() ? pathOrUndefined : undefined
    const filePath = relativePath ?? join('.jsxp-diagnostics', defaultFileName)
    return isAbsolute(filePath) ? filePath : join(process.cwd(), filePath)
  }

  async #saveErrorDiagnostics(
    page: Page,
    context: BrowserContext,
    options: RenderOptions | undefined,
    traceActive: boolean
  ) {
    const diagnostics = options?.playwright?.diagnostics
    if (!diagnostics?.enabled) {
      return { traceActive }
    }

    const now = Date.now()

    if (diagnostics.includeScreenshot !== false) {
      try {
        const screenshotPath = this.#resolveDiagnosticsPath(
          diagnostics.screenshotPath,
          `playwright-error-${now}.png`
        )
        await mkdir(dirname(screenshotPath), { recursive: true })
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})
        console.warn('[playwright-core] error screenshot saved:', screenshotPath)
      } catch {
        // best effort diagnostics
      }
    }

    if (traceActive && diagnostics.includeTrace !== false) {
      try {
        const tracePath = this.#resolveDiagnosticsPath(
          diagnostics.tracePath,
          `playwright-trace-${now}.zip`
        )
        await mkdir(dirname(tracePath), { recursive: true })
        await context.tracing.stop({ path: tracePath })
        traceActive = false
        console.warn('[playwright-core] error trace saved:', tracePath)
      } catch {
        // best effort diagnostics
      }
    }

    return { traceActive }
  }

  async withPage<TResult>(
    html: string,
    options: RenderOptions | undefined,
    run: PlaywrightPageHandler<TResult>
  ): Promise<TResult | null> {
    const maxAttempts = options?.playwright?.retryOnBrowserError === false ? 1 : 2

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (!(await this.isStart())) return null
      const browser = this.browser
      if (!browser) return null

      this.#fileReadCache.clear()
      const { goto, playwright } = options ?? {}
      const pooledContext = await this.#acquireContext(browser, options)
      const context = pooledContext.context
      const page = await context.newPage()
      await this.#registerPage(page, options)

      let traceActive = false
      if (playwright?.diagnostics?.enabled && playwright.diagnostics.includeTrace !== false) {
        await context.tracing.start({ screenshots: true, snapshots: true }).catch(() => {})
        traceActive = true
      }

      try {
        if (playwright?.media !== undefined || playwright?.colorScheme !== undefined) {
          await page.emulateMedia({
            media: playwright?.media ?? null,
            colorScheme: playwright?.colorScheme ?? null
          })
        }

        const waitUntil = Array.isArray(goto?.waitUntil) ? goto.waitUntil[0] : goto?.waitUntil
        await page.setContent(html, {
          waitUntil:
            waitUntil === 'networkidle0' || waitUntil === 'networkidle2'
              ? 'networkidle'
              : (waitUntil ?? 'load'),
          timeout: goto?.timeout ?? 60000
        })

        if (playwright?.waitForNetworkIdle) {
          await page.waitForLoadState('networkidle', { timeout: goto?.timeout ?? 60000 })
        }

        return await run(page, context)
      } catch (error) {
        const result = await this.#saveErrorDiagnostics(page, context, options, traceActive)
        traceActive = result.traceActive

        const shouldRetry = attempt < maxAttempts && shouldRestartBrowser(error)
        if (!shouldRetry) {
          throw error
        }

        console.warn(
          `[playwright-core] browser-level error, retrying once (attempt ${attempt + 1}/${maxAttempts})`
        )
        await this.#doRestart().catch(() => false)
      } finally {
        if (traceActive) {
          await context.tracing.stop().catch(() => {})
        }
        await this.#releaseContext(pooledContext)
      }
    }

    return null
  }

  async close() {
    await this.#drainContextPool()
    this.#browserGeneration++
    this.#isBrowser = false
    if (!this.browser) return
    await this.browser.close().catch(() => {})
    this.browser = null
  }
}

function gotoTimeout(options: RenderOptions | undefined) {
  return options?.goto?.timeout ?? 60000
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function calculateDynamicContextPoolSize() {
  const totalMemory = os.totalmem()
  const freeMemory = os.freemem()
  const byTotalMemory = Math.floor(totalMemory / (2 * GIB))
  const byFreeMemory = Math.floor(freeMemory / RECOMMENDED_BYTES_PER_CONTEXT)
  return clamp(Math.min(byTotalMemory, byFreeMemory), 1, 16)
}

function isBoxStable(prev: BoundingBox | null, next: BoundingBox | null, epsilon = 0.5) {
  if (!prev || !next) return false
  return (
    Math.abs(prev.x - next.x) <= epsilon &&
    Math.abs(prev.y - next.y) <= epsilon &&
    Math.abs(prev.width - next.width) <= epsilon &&
    Math.abs(prev.height - next.height) <= epsilon
  )
}

async function waitForStableLocator(
  page: Page,
  locator: ReturnType<Page['locator']>,
  stableFrames: number,
  intervalMs: number,
  timeoutMs: number
) {
  const deadline = Date.now() + timeoutMs
  let lastBox: BoundingBox | null = null
  let stableCount = 0

  while (Date.now() < deadline) {
    const box = (await locator.boundingBox()) as BoundingBox | null
    if (isBoxStable(lastBox, box)) {
      stableCount++
      if (stableCount >= stableFrames) {
        return
      }
    } else {
      stableCount = 1
    }

    lastBox = box
    await page.waitForTimeout(intervalMs)
  }
}
