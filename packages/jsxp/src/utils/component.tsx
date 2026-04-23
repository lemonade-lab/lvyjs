import React from 'react'
import { renderToString } from 'react-dom/server'
import { access } from 'fs/promises'
import type { ComponentCreateOpsionType } from '../types'

/** HTML路径处理模式 */
export type PathMode = 'local' | 'server'

/** 文件存在性缓存，带 TTL 使 false 结果可过期 */
const _existsCache = new Map<string, { value: boolean; ts: number }>()
const EXIST_CACHE_MAX = 500
/** false 结果的过期时间（毫秒），true 结果不过期 */
const EXIST_FALSE_TTL = 5000

async function fileExists(filePath: string): Promise<boolean> {
  const cached = _existsCache.get(filePath)
  if (cached) {
    // true 永不过期；false 在 TTL 内有效
    if (cached.value || Date.now() - cached.ts < EXIST_FALSE_TTL) {
      return cached.value
    }
    _existsCache.delete(filePath)
  }
  const exists = await access(filePath).then(
    () => true,
    () => false
  )
  if (_existsCache.size >= EXIST_CACHE_MAX) {
    const oldest = _existsCache.keys().next().value
    if (oldest !== undefined) _existsCache.delete(oldest)
  }
  _existsCache.set(filePath, { value: exists, ts: Date.now() })
  return exists
}

/**
 * 处理HTML中的本地文件路径（异步）
 * @param html HTML字符串
 * @param mode 模式：local 使用 jsxp:// 协议，server 使用 /_jsxp_file?path= 路由
 * @returns 处理后的HTML
 */
/** 模块级正则常量，避免每次调用重新编译 */
const PATH_PATTERN = /(?:(src|href)=(["'])([^"']+)\2)|(?:url\(["']?([^"')]+)["']?\))/g

export async function processHtmlPaths(html: string, mode: PathMode): Promise<string> {
  // 重置正则 lastIndex
  PATH_PATTERN.lastIndex = 0
  const candidates: {
    index: number
    length: number
    link: string
    filePath: string
    attrName?: string
    quote?: string
  }[] = []
  let m: RegExpExecArray | null

  // 第一遍：收集所有候选匹配
  while ((m = PATH_PATTERN.exec(html)) !== null) {
    const link = m[3] ?? m[4]
    if (!link) continue
    candidates.push({
      index: m.index,
      length: m[0].length,
      link,
      filePath: decodeURIComponent(link),
      attrName: m[1],
      quote: m[2]
    })
  }

  if (candidates.length === 0) return html

  // 批量并行检查所有文件是否存在
  const existResults = await Promise.all(candidates.map(c => fileExists(c.filePath)))

  // 过滤出存在的文件并构建替换列表，从后往前替换避免索引偏移
  for (let i = candidates.length - 1; i >= 0; i--) {
    if (!existResults[i]) continue
    const { index, length, link, filePath, attrName, quote } = candidates[i]
    const newPath =
      mode === 'server'
        ? `/_jsxp_file?path=${encodeURIComponent(link)}`
        : `jsxp://${encodeURIComponent(filePath)}`
    const replacement = attrName ? `${attrName}=${quote}${newPath}${quote}` : `url(${newPath})`
    html = html.slice(0, index) + replacement + html.slice(index + length)
  }

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
    if (mode) return await processHtmlPaths(html, mode)
    return html
  }
}
