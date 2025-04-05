import { renderToString } from 'react-dom/server'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { ComponentCreateOpsionType } from '../types.ts'

/**
 * ************
 * 组件解析
 * **********
 */
export class Component {
  //
  #dir = ''
  //
  constructor() {
    this.#dir = join(process.cwd(), '.data', 'component')
  }

  /**
   * 编译html
   * @param options
   * @returns
   */
  compile(options: ComponentCreateOpsionType) {
    const DOCTYPE = '<!DOCTYPE html>'
    const HTML = renderToString(options.component)
    const html = `${DOCTYPE}${HTML}`
    /**
     * create false
     */
    if (typeof options?.create == 'boolean' && options?.create == false) {
      // is server  启动 server 解析
      if (options.server === true) return this.processHtmlPaths(html)
      //
      return html
    }
    /**
     * create true
     */
    const dir = join(this.#dir, options?.path ?? '')
    // mkdir
    mkdirSync(dir, { recursive: true })
    // url
    const address = join(dir, options?.name ?? 'jsxp.html')
    // write
    writeFileSync(address, options.server === true ? this.processHtmlPaths(html) : html)
    // url
    return address
  }

  /**
   * 处理html路径
   * @param html
   * @returns
   */
  processHtmlPaths = (html: string) => {
    // 使用正则表达式提取所有 src 和 href 属性中的路径
    const attrRegex = /(src|href)=["']([^"']+)["']/g
    html = html.replace(attrRegex, (match, attr, link) => {
      const url = decodeURIComponent(link)
      if (existsSync(url)) {
        const newPath = `/files?path=${encodeURIComponent(link)}`
        return `${attr}="${newPath}"`
      }
      return match
    })
    // 使用正则表达式提取 CSS 中 url() 的路径
    const urlRegex = /url\(["']?([^"')]+)["']?\)/g
    html = html.replace(urlRegex, (match, link) => {
      const url = decodeURIComponent(link)
      if (existsSync(url)) {
        const newPath = `/files?path=${encodeURIComponent(link)}`
        return `url(${newPath})`
      }
      return match
    })
    return html
  }
}
