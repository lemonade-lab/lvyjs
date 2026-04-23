import os from 'os'
import { execSync } from 'child_process'
import { existsSync, promises as fsp } from 'fs'
import puppeteer, {
  Browser,
  Page,
  type LaunchOptions as PuppeteerLaunchOptions
} from 'puppeteer-core'
import path from 'path'
import type { RenderOptions } from '../types.js'

/**
 * 浏览器可执行文件路径的环境变量候选列表，按优先级顺序排列
 */
const EXECUTABLE_ENV_KEYS = [
  'PUPPETEER_EXECUTABLE_PATH',
  'JSXP_EXECUTABLE_PATH',
  // 其他常见环境变量，兼容性更好
  'GOOGLE_CHROME_BIN',
  'CHROME_BIN',
  'CHROMIUM_PATH',
  'CHROMIUM_BIN',
  'EDGE_PATH'
] as const

// 推荐优先使用的环境变量列表，供错误提示使用
const RECOMMENDED_ENV_KEYS = EXECUTABLE_ENV_KEYS.slice(0, 2)

const WINDOWS_PROGRAM_FILES = [
  process.env.PROGRAMFILES,
  process.env['PROGRAMFILES(X86)'],
  process.env.ProgramW6432
].filter((value): value is string => Boolean(value))

const WINDOWS_LOCAL_APP_DATA = process.env.LOCALAPPDATA

const DARWIN_APPLICATION_ROOTS = ['/Applications', path.join(os.homedir(), 'Applications')]

function uniquePaths(values: readonly string[]) {
  return [...new Set(values)]
}

/**
 * 命令行候选列表，按优先级顺序排列
 * Unix 系统通过 `command -v` 检测，Windows 通过 `where` 检测
 */
const COMMAND_CANDIDATES = [
  'chromium',
  'chromium-browser',
  'chrome',
  'google-chrome',
  'google-chrome-stable',
  'google-chrome-beta',
  'google-chrome-canary',
  'microsoft-edge',
  'microsoft-edge-stable',
  'microsoft-edge-beta',
  'microsoft-edge-dev',
  'msedge',
  'msedge.exe',
  'chrome.exe',
  'brave-browser',
  'brave-browser-stable',
  'brave.exe'
]

/**
 * 平台特定的浏览器路径候选列表，按优先级顺序排列
 * 适用于常见操作系统，覆盖了常见的安装路径
 */
const PLATFORM_PATH_CANDIDATES: Record<NodeJS.Platform | 'default', string[]> = {
  aix: [],
  android: uniquePaths([
    '/system/bin/chrome',
    '/system/bin/chromium',
    '/product/bin/chrome',
    '/product/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chrome',
    '/data/data/com.termux/files/usr/bin/chromium',
    '/data/data/com.termux/files/usr/bin/chromium-browser',
    '/data/data/com.termux/files/usr/bin/google-chrome'
  ]),
  darwin: uniquePaths(
    DARWIN_APPLICATION_ROOTS.flatMap(root => [
      path.join(root, 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
      path.join(root, 'Google Chrome Beta.app', 'Contents', 'MacOS', 'Google Chrome Beta'),
      path.join(root, 'Google Chrome Canary.app', 'Contents', 'MacOS', 'Google Chrome Canary'),
      path.join(root, 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
      path.join(root, 'Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge'),
      path.join(root, 'Microsoft Edge Beta.app', 'Contents', 'MacOS', 'Microsoft Edge Beta'),
      path.join(root, 'Microsoft Edge Dev.app', 'Contents', 'MacOS', 'Microsoft Edge Dev'),
      path.join(root, 'Microsoft Edge Canary.app', 'Contents', 'MacOS', 'Microsoft Edge Canary'),
      path.join(root, 'Brave Browser.app', 'Contents', 'MacOS', 'Brave Browser')
    ])
  ),
  freebsd: ['/usr/local/bin/chromium', '/usr/local/bin/chrome'],
  haiku: [],
  linux: uniquePaths([
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome-beta',
    '/usr/bin/google-chrome-canary',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
    '/usr/bin/microsoft-edge-beta',
    '/usr/bin/microsoft-edge-dev',
    '/usr/bin/brave-browser',
    '/usr/bin/brave-browser-stable',
    '/usr/local/bin/chromium',
    '/usr/local/bin/chromium-browser',
    '/usr/local/bin/google-chrome',
    '/usr/local/bin/google-chrome-stable',
    '/usr/local/bin/microsoft-edge',
    '/usr/local/bin/brave-browser',
    '/opt/google/chrome/chrome',
    '/opt/google/chrome-beta/chrome',
    '/opt/google/chrome-unstable/chrome',
    '/opt/microsoft/msedge/msedge',
    '/opt/microsoft/msedge-beta/msedge',
    '/opt/microsoft/msedge-dev/msedge',
    '/opt/brave.com/brave/brave-browser',
    '/snap/bin/chromium',
    '/snap/bin/chromium-browser',
    '/snap/bin/google-chrome',
    '/snap/bin/microsoft-edge',
    '/snap/bin/brave'
  ]),
  openbsd: ['/usr/local/bin/chromium', '/usr/local/bin/chrome'],
  sunos: [],
  win32: uniquePaths([
    ...WINDOWS_PROGRAM_FILES.flatMap(root => [
      path.win32.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.win32.join(root, 'Google', 'Chrome Beta', 'Application', 'chrome.exe'),
      path.win32.join(root, 'Google', 'Chrome SxS', 'Application', 'chrome.exe'),
      path.win32.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.win32.join(root, 'Microsoft', 'Edge Beta', 'Application', 'msedge.exe'),
      path.win32.join(root, 'Microsoft', 'Edge Dev', 'Application', 'msedge.exe'),
      path.win32.join(root, 'Microsoft', 'Edge SxS', 'Application', 'msedge.exe'),
      path.win32.join(root, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')
    ]),
    ...(WINDOWS_LOCAL_APP_DATA
      ? [
          path.win32.join(WINDOWS_LOCAL_APP_DATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.win32.join(
            WINDOWS_LOCAL_APP_DATA,
            'Google',
            'Chrome Beta',
            'Application',
            'chrome.exe'
          ),
          path.win32.join(
            WINDOWS_LOCAL_APP_DATA,
            'Google',
            'Chrome SxS',
            'Application',
            'chrome.exe'
          ),
          path.win32.join(WINDOWS_LOCAL_APP_DATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          path.win32.join(
            WINDOWS_LOCAL_APP_DATA,
            'Microsoft',
            'Edge Beta',
            'Application',
            'msedge.exe'
          ),
          path.win32.join(
            WINDOWS_LOCAL_APP_DATA,
            'Microsoft',
            'Edge Dev',
            'Application',
            'msedge.exe'
          ),
          path.win32.join(
            WINDOWS_LOCAL_APP_DATA,
            'Microsoft',
            'Edge SxS',
            'Application',
            'msedge.exe'
          ),
          path.win32.join(
            WINDOWS_LOCAL_APP_DATA,
            'BraveSoftware',
            'Brave-Browser',
            'Application',
            'brave.exe'
          )
        ]
      : [])
  ]),
  cygwin: [],
  netbsd: [],
  default: uniquePaths([
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/microsoft-edge',
    '/usr/bin/brave-browser',
    '/opt/google/chrome/chrome',
    '/opt/microsoft/msedge/msedge',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ])
}

/**
 * 解析浏览器可执行文件路径的优先级顺序：
 * 1. 使用 launch.executablePath 指定的路径
 * 2. 使用环境变量指定的路径
 * 3. 使用命令行检测到的路径（适用于 Windows、Linux、Android 和 macOS）
 * 4. 使用平台特定的默认路径
 * @param value
 * @returns
 */
function isExistingExecutablePath(value?: string | null): value is string {
  return Boolean(value && existsSync(value))
}

/**
 * 从环境变量中获取浏览器可执行文件路径
 * @returns
 */
function getEnvExecutablePath(): string | null {
  for (const key of EXECUTABLE_ENV_KEYS) {
    const value = process.env[key]?.trim()
    if (isExistingExecutablePath(value)) {
      return value
    }
  }
  return null
}

/**
 * 通过命令行检测浏览器可执行文件路径，适用于 Windows、Linux、Android 和 macOS 平台
 * @returns
 */
function getCommandExecutablePath(): string | null {
  if (!['win32', 'linux', 'android', 'darwin'].includes(process.platform)) {
    return null
  }

  for (const item of COMMAND_CANDIDATES) {
    try {
      const lookupCommand = process.platform === 'win32' ? `where ${item}` : `command -v ${item}`
      const commandOutput = execSync(lookupCommand, {
        stdio: ['ignore', 'pipe', 'ignore']
      })
        .toString()
        .trim()

      const executablePath = commandOutput
        .split(/\r?\n/)
        .map(line => line.trim())
        .find(isExistingExecutablePath)

      if (isExistingExecutablePath(executablePath)) {
        return executablePath
      }
    } catch {}
  }

  return null
}

/**
 * 从平台特定的默认路径中获取浏览器可执行文件路径
 * @returns
 */
function getCandidateExecutablePath(): string | null {
  const candidates = [
    ...(PLATFORM_PATH_CANDIDATES[process.platform] ?? []),
    ...PLATFORM_PATH_CANDIDATES.default
  ]

  for (const item of candidates) {
    if (isExistingExecutablePath(item)) {
      return item
    }
  }

  return null
}

/**
 * 解析浏览器可执行文件路径，按照优先级顺序检查 launch.executablePath、环境变量、命令行和平台特定路径
 * @param launch
 * @returns
 */
function resolveExecutablePath(launch?: PuppeteerLaunchOptions): string | null {
  if (isExistingExecutablePath(launch?.executablePath)) {
    return launch.executablePath
  }

  return getEnvExecutablePath() ?? getCommandExecutablePath() ?? getCandidateExecutablePath()
}

/**
 *  获取缺失浏览器的错误提示，包含针对不同平台的安装建议和环境变量配置说明
 * @returns
 */
function getMissingBrowserError() {
  const arch = os.arch()
  const envKeys = RECOMMENDED_ENV_KEYS.join(', ')
  const archHint =
    arch === 'arm64' ? '当前架构为 arm64，请确认本机已安装可用的 Chrome、Chromium 或 Edge。' : ''

  return new Error(
    [
      '[puppeteer-core] 未找到可用的浏览器可执行文件。',
      '请先安装 Google Chrome、Chromium 或 Microsoft Edge，然后优先使用以下方式配置路径：',
      `1. 设置环境变量：${envKeys}`,
      '2. 在项目中配置 .puppeteerrc.cjs 或 .puppeteerrc.mjs，提供 executablePath',
      '3. jsxp 仍会继续尝试内置探测逻辑，自动查找本机已安装的浏览器路径',
      '不推荐在业务代码里通过 new Picture(...) 或 new Puppeteer(...) 传入 executablePath 作为通用配置方式。',
      archHint
    ]
      .filter(Boolean)
      .join('\n')
  )
}

/**
 * MIME类型映射
 */
const MIME_MAP: Record<string, string> = {
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  wav: 'audio/wav',
  webm: 'video/webm',
  ico: 'image/x-icon'
}

/** 需要扫描内部 url() 引用的文本类型 */
const TEXT_TYPES = new Set(['css', 'html', 'htm', 'svg', 'js', 'mjs'])

/** url() 匹配正则 */
const CSS_URL_RE = /url\(["']?([^"')]+)["']?\)/g

/**
 * 扫描文本内容中的 url() 引用，将本地路径重写为 jsxp:// 协议
 * @param content 文件文本内容
 * @param fileDir 文件所在目录，用于解析相对路径
 */
function rewriteLocalUrls(content: string, fileDir: string): string {
  return content.replace(CSS_URL_RE, (match, ref: string) => {
    // 跳过 web 协议、data URI、已改写的 jsxp://
    if (/^(https?:|data:|blob:|jsxp:|#)/i.test(ref)) return match
    // 解析为绝对路径（支持相对路径和绝对路径）
    const absPath = path.resolve(fileDir, ref)
    return `url(jsxp://${encodeURIComponent(absPath)})`
  })
}

/**
 * 默认参数配置
 */
export const PuppeteerDefineOptioins: PuppeteerLaunchOptions = {
  // 禁用超时
  timeout: 0, //otocolTimeout: 0,
  // 请求头
  headless: true,
  //
  args: [
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
    '--no-first-run',
    '--no-sandbox',
    '--no-zygote',
    '--single-process'
  ]
  // executablePath: ''
  // BOT浏览器默认尺寸 753 X 1180
}

/**
 * 无头浏览器配置
 */
export const PuppeteerOptimizeOptioins: PuppeteerLaunchOptions = {
  timeout: 0, //otocolTimeout: 0,
  headless: true, // 无头模式
  args: [
    '--disable-dev-shm-usage', // 禁用 /dev/shm 的使用，防止共享内存不足的问题
    '--disable-setuid-sandbox', // 禁用 setuid 沙盒
    '--no-first-run', // 跳过首次运行的设置
    '--no-sandbox', // 禁用沙盒模式
    '--no-zygote', // 禁用 zygote 进程
    '--single-process', // 使浏览器在单个进程中运行
    '--disable-background-networking', // 禁用后台网络请求
    '--disable-background-timer-throttling', // 禁用后台计时器节流
    '--disable-backgrounding-occluded-windows', // 禁用后台窗口
    '--disable-breakpad', // 禁用崩溃报告
    '--disable-client-side-phishing-detection', // 禁用客户端钓鱼检测
    '--disable-component-update', // 禁用组件更新
    '--disable-default-apps', // 禁用默认应用
    '--disable-domain-reliability', // 禁用域名可靠性
    '--disable-extensions', // 禁用扩展
    '--disable-features=AudioServiceOutOfProcess', // 禁用音频服务进程外处理
    '--disable-hang-monitor', // 禁用挂起监视器
    '--disable-ipc-flooding-protection', // 禁用 IPC 洪水保护
    '--disable-popup-blocking', // 禁用弹出窗口阻止
    '--disable-print-preview', // 禁用打印预览
    '--disable-prompt-on-repost', // 禁用重新发布提示
    '--disable-renderer-backgrounding', // 禁用渲染器后台处理
    '--disable-sync', // 禁用同步
    '--force-color-profile=srgb', // 强制使用 sRGB 颜色配置文件
    '--metrics-recording-only', // 仅记录指标
    '--safebrowsing-disable-auto-update', // 禁用安全浏览自动更新
    '--enable-automation', // 启用自动化
    '--password-store=basic', // 使用基本密码存储
    '--use-mock-keychain' // 使用模拟密钥链
  ]
}

/**
 * 无头浏览器
 */
export class Puppeteer {
  // 状态
  #isBrowser = false

  // 配置
  #launch: PuppeteerLaunchOptions = { ...PuppeteerDefineOptioins }

  // 应用缓存
  browser: Browser | null = null

  // Page 对象池，复用已创建的页面避免反复 newPage 开销
  #pagePool: Page[] = []
  #MAX_POOL_SIZE = 6

  // jsxp:// 文件读取缓存，同一渲染周期内去重磁盘读取
  #fileReadCache = new Map<string, Promise<Buffer>>()
  // 每个 Page 的使用计数，超过阈值则淘汰重建，避免内存累积
  #pageUseCount = new WeakMap<Page, number>()
  #PAGE_MAX_USES = 50

  // 启动锁，防止并发重启竞态
  #startPromise: Promise<boolean> | null = null

  /**
   * 将截图结果转为 Buffer
   */
  #toBuffer(buff: Uint8Array | Buffer | string | void, encoding?: BufferEncoding): Buffer | null {
    if (!buff) return null
    if (Buffer.isBuffer(buff)) return buff
    if (buff instanceof Uint8Array)
      return Buffer.from(buff.buffer, buff.byteOffset, buff.byteLength)
    if (typeof buff === 'string') {
      if (buff.startsWith('data:')) {
        const base64Data = buff.split(',')[1] || ''
        return Buffer.from(base64Data, 'base64')
      }
      return Buffer.from(buff, encoding)
    }
    return null
  }

  /**
   * 读取浏览器地址
   * 未配置将使用内置的自动查询流
   */
  constructor(launch?: PuppeteerLaunchOptions) {
    if (launch) {
      this.#launch = {
        ...this.#launch,
        ...launch
      }
    }
  }

  /**
   * 设置
   * @param val
   */
  setLaunch(val: PuppeteerLaunchOptions) {
    this.#launch = {
      ...this.#launch,
      ...val
    }
    return this
  }

  /**
   * 获取
   * @returns
   */
  getLaunch(): PuppeteerLaunchOptions {
    return this.#launch
  }

  /**
   * 启动pup
   * @returns
   */
  async start() {
    try {
      const executablePath = resolveExecutablePath(this.#launch)
      const launchOptions = {
        ...this.#launch,
        ...(executablePath ? { executablePath } : {})
      }

      if (!launchOptions.executablePath && !launchOptions.channel) {
        throw getMissingBrowserError()
      }

      this.browser = await puppeteer.launch(launchOptions)
      this.#isBrowser = true
      // console.info('[puppeteer-core] open success')
      return true
    } catch (err) {
      this.#isBrowser = false
      console.error(err)
      return false
    }
  }
  /**
   * 确保浏览器已启动，断连时自动重启
   */
  async isStart() {
    if (this.#isBrowser && this.browser?.connected) {
      return true
    }
    // 并发调用共享同一个启动流程，避免重复重启
    if (this.#startPromise) return this.#startPromise
    this.#startPromise = this.#doRestart()
    try {
      return await this.#startPromise
    } finally {
      this.#startPromise = null
    }
  }

  async #doRestart() {
    // 清空池中的旧页面引用
    this.#pagePool = []
    this.#isBrowser = false
    if (this.browser) {
      await this.browser.close().catch(() => {})
      this.browser = null
    }
    return this.start()
  }

  /**
   * 从池中获取可用 Page，池为空时创建新 Page 并注册拦截
   */
  async #acquirePage(): Promise<Page | null> {
    while (this.#pagePool.length > 0) {
      const page = this.#pagePool.pop()!
      if (!page.isClosed()) return page
    }
    const page = await this.browser?.newPage()
    if (!page) return null
    await page.setRequestInterception(true)
    page.on('request', async req => {
      try {
        const url = req.url()
        if (url.startsWith('jsxp://')) {
          let localPath = decodeURIComponent(url.replace(/^jsxp:\/\//, ''))
          if (/^\/[A-Za-z]:\//.test(localPath)) localPath = localPath.slice(1)
          try {
            // 缓存文件读取，同一文件只读一次磁盘
            if (!this.#fileReadCache.has(localPath)) {
              this.#fileReadCache.set(localPath, fsp.readFile(localPath))
            }
            const buf = await this.#fileReadCache.get(localPath)!
            const ext = path.extname(localPath).slice(1).toLowerCase()
            // 文本类型文件扫描 url() 引用，重写为 jsxp:// 确保嵌套资源也走拦截
            let body: Buffer | string = buf
            if (TEXT_TYPES.has(ext)) {
              const fileDir = path.dirname(localPath)
              body = rewriteLocalUrls(buf.toString('utf-8'), fileDir)
            }
            await req.respond({
              status: 200,
              contentType: MIME_MAP[ext] || 'application/octet-stream',
              body
            })
          } catch {
            console.warn('[puppeteer-core] local file not found:', localPath)
            this.#fileReadCache.delete(localPath)
            await req.respond({ status: 404, body: 'Not found' })
          }
          return
        }
        await req.continue()
      } catch {
        // 页面已关闭或请求已处理
      }
    })
    return page
  }

  /**
   * 归还 Page 到池中复用，超出上限或使用次数过多则关闭
   */
  async #releasePage(page: Page) {
    if (page.isClosed()) return
    const uses = (this.#pageUseCount.get(page) ?? 0) + 1
    this.#pageUseCount.set(page, uses)
    if (uses >= this.#PAGE_MAX_USES || this.#pagePool.length >= this.#MAX_POOL_SIZE) {
      await page.close().catch(() => {})
    } else {
      this.#pagePool.push(page)
    }
  }

  /**
   * 渲染HTML并截图
   * 使用 Page 池 + setContent + jsxp:// 异步请求拦截
   */
  async render(html: string, Options?: RenderOptions) {
    if (!(await this.isStart())) return null
    // 每次渲染清空文件缓存，避免跨渲染累积
    this.#fileReadCache.clear()
    const page = await this.#acquirePage()
    if (!page) return null
    const { goto, selector, screenshot, bufferFromEncoding } = Options ?? {}

    try {
      await page.setContent(html, {
        waitUntil: 'load',
        timeout: 60000,
        ...(goto ?? {})
      })

      const body = await page.$(selector ?? 'body')
      if (!body) return null

      console.info('[puppeteer-core] success')
      const buff = await body.screenshot({ type: 'png', ...(screenshot ?? {}) })
      return this.#toBuffer(buff, bufferFromEncoding)
    } catch (err) {
      await page.close().catch(() => {})
      throw err
    } finally {
      if (!page.isClosed()) {
        await this.#releasePage(page)
      }
    }
  }
}
