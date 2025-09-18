import { PuppeteerLaunchOptions } from 'puppeteer'
import { Component } from './component'
import { Puppeteer } from './puppeteer'
import { ComponentCreateOpsionType, RenderOptions } from '../types'
/**
 * 截图类
 * 结合了组件和浏览器
 */
export class Picture {
  /**
   * 浏览器控制
   */
  puppeteer: typeof Puppeteer.prototype
  /**
   * 组件控制
   */
  component: typeof Component.prototype
  /**
   * 初始化组件和浏览器
   */
  constructor(launch?: PuppeteerLaunchOptions) {
    this.component = new Component()
    this.puppeteer = new Puppeteer(launch)
  }

  /**
   * 截图组件
   * @param options 组件选项
   * @param RenderOptions 渲染选项
   * @returns 截图Buffer或HTML地址
   */
  async screenshot(options: ComponentCreateOpsionType, RenderOptions?: RenderOptions) {
    const Address = this.component.compile(options)
    if (typeof options.create == 'boolean' && options.create === false) return Address
    return await this.puppeteer.render(Address, RenderOptions)
  }

  /**
   * 纯HTML模式截图
   * @param htmlContent HTML内容字符串
   * @param RenderOptions 渲染选项
   * @returns 截图Buffer或null
   */
  async screenshotHtml(htmlContent: string, RenderOptions?: RenderOptions) {
    return await this.puppeteer.renderHtml(htmlContent, RenderOptions)
  }
}
