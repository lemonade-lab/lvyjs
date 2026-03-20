import React from 'react'
import { renderToString } from 'react-dom/server'
import { existsSync } from 'fs'
import { ComponentCreateOpsionType } from '../types.ts'

/**
 * HTML路径处理模式
 */
export type PathMode = 'local' | 'server'

/**
 * 处理HTML中的本地文件路径
 * @param html HTML字符串
 * @param mode 模式：local 使用 jsxp:// 协议，server 使用 /_jsxp_file?path= 路由
 * @returns 处理后的HTML
 */
export function processHtmlPaths(html: string, mode: PathMode): string {
  const rewrite = (link: string) => {
    const filePath = decodeURIComponent(link)
    if (!existsSync(filePath)) return null
    if (mode === 'server') {
      return `/_jsxp_file?path=${encodeURIComponent(link)}`
    }
    return `jsxp://${encodeURIComponent(filePath)}`
  }

  // 处理 src/href 属性中的路径
  html = html.replace(/(src|href)=(["'])([^"']+)\2/g, (match, attr, quote, link) => {
    const newPath = rewrite(link)
    return newPath ? `${attr}=${quote}${newPath}${quote}` : match
  })

  // 处理 CSS url() 中的路径
  html = html.replace(/url\(["']?([^"')]+)["']?\)/g, (match, link) => {
    const newPath = rewrite(link)
    return newPath ? `url(${newPath})` : match
  })

  return html
}

/**
 * ************
 * 组件解析
 * **********
 */
export class Component {
  /**
   * 编译组件为HTML字符串
   * @param options 组件选项
   * @param mode 路径处理模式
   * @returns HTML字符串
   */
  async compile(options: ComponentCreateOpsionType, mode?: PathMode) {
    let html: string
    if ('html' in options && options.html) {
      html = options.html
    } else if ('element' in options && options.element) {
      const props = options.propsCall ? await options.propsCall() : {}
      html = `<!DOCTYPE html>${renderToString(React.createElement(options.element, props))}`
    } else {
      html = `<!DOCTYPE html>${renderToString(options.component)}`
    }
    if (mode) return processHtmlPaths(html, mode)
    return html
  }
}
