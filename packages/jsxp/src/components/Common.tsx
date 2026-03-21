import React from 'react'
import fs from 'fs'
import path from 'path'

const MIME: Record<string, string> = {
  // image
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  avif: 'image/avif',
  // font
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  // audio/video
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  // data
  json: 'application/json',
  webmanifest: 'application/manifest+json',
  // style/script
  css: 'text/css',
  js: 'application/javascript'
}

function getMime(filePath: string, fallback = 'application/octet-stream') {
  return MIME[path.extname(filePath).slice(1).toLowerCase()] ?? fallback
}

/**
 * 判断是否是常见的 web 协议
 */
function isWebUrl(url: string) {
  return /^(https?:|data:|blob:|mailto:|tel:)/i.test(url)
}

/** 文件缓存（LRU 上限 200 条） */
const FILE_CACHE_MAX = 200
const fileCache = new Map<string, Buffer | null>()

/**
 * 只要不是 web 协议就尝试本地读取并返回 Buffer，否则返回 null
 * @deprecated 使用同步 I/O，阻塞事件循环。建议改用 jsxp:// 协议由 Puppeteer 异步加载本地文件
 */
function tryReadLocal(url: string): Buffer | null {
  if (!url || isWebUrl(url)) return null
  let filePath = url
  if (url.startsWith('file://')) filePath = url.replace(/^file:\/\//i, '')
  if (/^\/[A-Za-z]:\//.test(filePath)) filePath = filePath.slice(1)
  if (fileCache.has(filePath)) return fileCache.get(filePath)!
  let buf: Buffer | null
  try {
    buf = fs.readFileSync(filePath)
  } catch {
    buf = null
    console.warn(`文件不存在: ${filePath}`)
  }
  // 超出上限时淘汰最早的条目
  if (fileCache.size >= FILE_CACHE_MAX) {
    const oldest = fileCache.keys().next().value
    if (oldest !== undefined) fileCache.delete(oldest)
  }
  fileCache.set(filePath, buf)
  return buf
}

/**
 * 本地文件转 data URL，非本地返回 null
 * @deprecated 依赖同步 tryReadLocal，阻塞事件循环
 */
function toDataUrl(src: string, mime?: string): string | null {
  const buf = tryReadLocal(src)
  if (!buf) return null
  return `data:${mime ?? getMime(src)};base64,${buf.toString('base64')}`
}

/**
 * 1. 样式：本地自动内联，否则外链
 * @deprecated 使用同步 I/O，请改用 jsxp:// 协议加载本地样式
 */
export const StyleSheet: React.FC<{ src: string } & React.LinkHTMLAttributes<HTMLLinkElement>> = ({
  src,
  ...props
}) => {
  const buf = tryReadLocal(src)
  if (buf) return <style dangerouslySetInnerHTML={{ __html: buf.toString() }} />
  return <link rel="stylesheet" href={src} {...props} />
}
export const LinkStyleSheet = StyleSheet

/**
 * 2. 图片：本地自动 base64，其余直接 src
 * @deprecated 使用同步 I/O，请改用 jsxp:// 协议加载本地图片
 */
export const Image: React.FC<React.ImgHTMLAttributes<HTMLImageElement> & { src: string }> = ({
  src,
  ...props
}) => {
  return <img src={toDataUrl(src) ?? src} {...props} />
}

/**
 * 3. 背景图片：支持数组，本地自动 base64
 * @deprecated 使用同步 I/O，请改用 jsxp:// 协议加载本地图片
 */
export const BackgroundImage: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { src: string | string[] }
> = ({ src, style, ...props }) => {
  const srcArr = Array.isArray(src) ? src : [src]
  const bgImages = srcArr.map(item => `url('${toDataUrl(item) ?? item}')`)
  return <div style={{ ...style, backgroundImage: bgImages.join(', ') }} {...props} />
}

/**
 * 4. JS ESM 脚本：本地自动内联，其余外链
 * @deprecated 使用同步 I/O，请改用 jsxp:// 协议加载本地脚本
 */
export const ESM: React.FC<React.ScriptHTMLAttributes<HTMLScriptElement> & { src: string }> = ({
  src,
  children,
  ...rest
}) => {
  const buf = tryReadLocal(src)
  if (buf) {
    return <script type="module" {...rest} dangerouslySetInnerHTML={{ __html: buf.toString() }} />
  }
  return (
    <script type="module" src={src} {...rest}>
      {children}
    </script>
  )
}

/**
 * 5. 字体: 本地自动 base64，否则原样输出
 * @deprecated 使用同步 I/O，请改用 jsxp:// 协议加载本地字体
 */
export const FontFace: React.FC<{
  fontFamily: string
  src: string
}> = ({ fontFamily, src }) => {
  const fontSrc = toDataUrl(src) ?? src
  return (
    <style>{`
      @font-face {
        font-family: '${fontFamily}';
        src: url('${fontSrc}');
      }
    `}</style>
  )
}

/**
 * 6. SVG：本地自动内联SVG代码，其余直接img
 * @deprecated 使用同步 I/O，请改用 jsxp:// 协议加载本地 SVG
 */
export const SVG: React.FC<React.ImgHTMLAttributes<HTMLImageElement> & { src: string }> = ({
  src,
  ...props
}) => {
  const buf = tryReadLocal(src)
  if (buf) return <span dangerouslySetInnerHTML={{ __html: buf.toString() }} {...props} />
  return <img src={src} {...props} />
}

/**
 * 7. 音视频：本地自动 base64，其余直接 src
 * @deprecated 使用同步 I/O，请改用 jsxp:// 协议加载本地媒体
 */
export const Media: React.FC<
  (React.AudioHTMLAttributes<HTMLAudioElement> | React.VideoHTMLAttributes<HTMLVideoElement>) & {
    src: string
    tag?: 'audio' | 'video'
  }
> = ({ src, tag = 'audio', ...props }) => {
  const realSrc = toDataUrl(src) ?? src
  if (tag === 'audio') return <audio src={realSrc} {...props} />
  return <video src={realSrc} {...props} />
}

/**
 * 8. JSON数据：本地自动内联，否则忽略
 * @deprecated 使用同步 I/O，请改用 jsxp:// 协议加载本地 JSON
 */
export const JsonData: React.FC<{ src: string; id?: string }> = ({ src, id }) => {
  const buf = tryReadLocal(src)
  if (!buf) return null
  return (
    <script type="application/json" id={id} dangerouslySetInnerHTML={{ __html: buf.toString() }} />
  )
}

/**
 * 9. favicon/manifest等通用资源：本地自动 base64，其余外链
 * @deprecated 使用同步 I/O，请改用 jsxp:// 协议加载本地资源
 */
export const LinkRel: React.FC<{ rel: string; href: string }> = ({ rel, href, ...props }) => {
  return <link rel={rel} href={toDataUrl(href) ?? href} {...props} />
}
