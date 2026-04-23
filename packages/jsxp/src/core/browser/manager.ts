import type { LaunchOptions as PuppeteerLaunchOptions } from 'puppeteer-core'
import type { BrowserEngine, RenderOptions } from '../../types.js'
import { Playwright } from '../playwright/playwright.js'
import { Puppeteer } from '../puppeteer/puppeteer.js'
import type { BrowserRenderer } from './types.js'

export class BrowserManager implements BrowserRenderer {
  #preferredEngine: BrowserEngine
  #engine: BrowserRenderer | null = null
  #launch?: PuppeteerLaunchOptions

  constructor(launch?: PuppeteerLaunchOptions, preferredEngine: BrowserEngine = 'playwright') {
    this.#launch = launch
    this.#preferredEngine = preferredEngine
  }

  getPreferredEngine(): BrowserEngine {
    return this.#preferredEngine
  }

  getEngine(): BrowserEngine {
    return this.#engine?.getEngine() ?? this.#preferredEngine
  }

  #getEngineOrder(): BrowserEngine[] {
    return this.#preferredEngine === 'puppeteer'
      ? ['puppeteer', 'playwright']
      : ['playwright', 'puppeteer']
  }

  #createEngine(engine: BrowserEngine): BrowserRenderer {
    return engine === 'playwright' ? new Playwright(this.#launch) : new Puppeteer(this.#launch)
  }

  async start() {
    for (const engine of this.#getEngineOrder()) {
      const instance = this.#createEngine(engine)
      if (await instance.start()) {
        this.#engine = instance
        return true
      }
    }
    this.#engine = null
    return false
  }

  async isStart() {
    if (this.#engine) {
      return this.#engine.isStart()
    }
    return this.start()
  }

  async render(html: string, options?: RenderOptions) {
    if (!(await this.isStart()) || !this.#engine) return null
    return this.#engine.render(html, options)
  }

  async close() {
    if (!this.#engine) return
    await this.#engine.close()
    this.#engine = null
  }
}
