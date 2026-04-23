import type { LaunchOptions as PuppeteerLaunchOptions } from 'puppeteer-core'
import { Component } from '../component'
import { BrowserManager } from './manager'
import type { BrowserEngine, ComponentCreateOptionsType, RenderOptions } from '../../types'

/**
 * 截图类
 * 结合了组件和浏览器
 */
export class Picture {
  /**
   * 浏览器控制
   */
  browser: typeof BrowserManager.prototype
  /**
   * 组件控制
   */
  component: typeof Component.prototype

  /**
   * 初始化组件和浏览器
   */
  constructor(launch?: PuppeteerLaunchOptions, preferredEngine?: BrowserEngine) {
    this.component = new Component()
    this.browser = new BrowserManager(launch, preferredEngine)
  }

  getPreferredEngine() {
    return this.browser.getPreferredEngine()
  }

  getEngine() {
    return this.browser.getEngine()
  }

  get puppeteer() {
    return this.browser
  }

  /**
   * 截图组件（本地模式，jsxp:// 拦截）
   * @param options 组件选项
   * @param RenderOptions 渲染选项
   * @returns 截图Buffer或null
   */
  async screenshot(options: ComponentCreateOptionsType, RenderOptions?: RenderOptions) {
    const html = await this.component.compile(options, 'local')
    return await this.browser.render(html, RenderOptions)
  }

  /**
   * 截图纯HTML（本地模式，jsxp:// 拦截）
   * @param htmlContent HTML内容字符串
   * @param RenderOptions 渲染选项
   * @returns 截图Buffer或null
   */
  async screenshotHtml(htmlContent: string, RenderOptions?: RenderOptions) {
    return await this.browser.render(htmlContent, RenderOptions)
  }
}
