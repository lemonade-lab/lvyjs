import { resolve } from 'path'

/** 需要扫描内部 url() 引用的文本类型 */
export const SERVER_TEXT_TYPES = new Set(['css', 'html', 'htm', 'svg', 'js', 'mjs'])
export const SERVER_CSS_URL_RE = /url\(["']?([^"')]+)["']?\)/g
export const SERVER_MIME: Record<string, string> = {
  css: 'text/css',
  html: 'text/html',
  htm: 'text/html',
  svg: 'image/svg+xml',
  js: 'application/javascript',
  mjs: 'application/javascript'
}

/**
 * 重写文本文件中的 url() 本地路径为 /_jsxp_file?path= 路由
 */
export function rewriteServerUrls(content: string, fileDir: string, prefix: string): string {
  return content.replace(SERVER_CSS_URL_RE, (match, ref: string) => {
    if (/^(https?:|data:|blob:|mailto:|tel:|#)/i.test(ref)) return match
    // 已经是 /_jsxp_file 路径则跳过
    if (ref.includes('/_jsxp_file')) return match
    const absPath = resolve(fileDir, ref)
    return `url(${prefix}/_jsxp_file?path=${encodeURIComponent(absPath)})`
  })
}
/** fsStat 检查间隔（毫秒），避免每次请求都做 syscall */
export const STAT_TTL = 1000
/** 模块缓存上限，防止无限增长 */
export const DYNAMIC_CACHE_MAX = 10
