import React from 'react'
import fs from 'fs'
import path from 'path'

/**
 * 判断是否是常见的 web 协议（http/https/data/blob/mailto/tel/...）
 */
function isCommonWebProtocol(url: string) {
  return /^(https?:|data:|blob:|mailto:|tel:)/i.test(url)
}

/**
 * 只要不是常见协议就尝试本地读取并返回 Buffer，否则返回 null
 */
function tryReadFileMaybeLocal(url: string): Buffer | null {
  if (!url || isCommonWebProtocol(url)) return null
  let filePath = url
  // 兼容 file:// 前缀
  if (url.startsWith('file://')) filePath = url.replace(/^file:\/\//i, '')
  // 兼容 windows 路径 file:///C:/xxx
  if (/^\/[A-Za-z]:\//.test(filePath)) filePath = filePath.slice(1)
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath)
  console.warn(`文件不存在: ${filePath}`)
  return null
}

// 1. 样式：本地自动内联，否则外链
export const StyleSheet: React.FC<{ src: string } & React.LinkHTMLAttributes<HTMLLinkElement>> = ({
  src,
  ...props
}) => {
  const content = tryReadFileMaybeLocal(src)
  if (content) return <style {...props} dangerouslySetInnerHTML={{ __html: content.toString() }} />
  return <link rel="stylesheet" href={src} {...props} />
}
export const LinkStyleSheet = StyleSheet

// 2. 图片：本地自动 base64，其余直接 src
export const Image: React.FC<React.ImgHTMLAttributes<HTMLImageElement> & { src: string }> = ({
  src,
  ...props
}) => {
  const content = tryReadFileMaybeLocal(src)
  if (content) {
    const ext = path.extname(src).slice(1)
    const mime = ext === 'jpg' ? 'jpeg' : ext
    const dataUrl = `data:image/${mime};base64,${content.toString('base64')}`
    return <img src={dataUrl} {...props} />
  }
  return <img src={src} {...props} />
}

// 3. 背景图片：支持数组，本地自动 base64
export const BackgroundImage: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { src: string | string[] }
> = ({ src, style, ...props }) => {
  const srcArr = Array.isArray(src) ? src : [src]
  const bgImages = srcArr
    .map(item => {
      const content = tryReadFileMaybeLocal(item)
      if (content) {
        const ext = path.extname(item).slice(1)
        const mime = ext === 'jpg' ? 'jpeg' : ext
        return `url('data:image/${mime};base64,${content.toString('base64')}')`
      }
      return `url('${item}')`
    })
    .filter(Boolean)
  if (bgImages.length === 0) return null
  return <div style={{ ...(style || {}), backgroundImage: bgImages.join(', ') }} {...props} />
}

// 4. JS ESM 脚本：本地自动内联，其余外链
export const ESM: React.FC<React.ScriptHTMLAttributes<HTMLScriptElement> & { src: string }> = ({
  src,
  children,
  ...rest
}) => {
  const content = tryReadFileMaybeLocal(src)
  if (content) {
    return (
      <script type="module" {...rest} dangerouslySetInnerHTML={{ __html: content.toString() }} />
    )
  }
  return (
    <script type="module" src={src} {...rest}>
      {children}
    </script>
  )
}

// 5. 字体: 本地自动 base64，否则原样输出
export const FontFace: React.FC<{
  fontFamily: string
  src: string
  style?: React.CSSProperties
}> = ({ fontFamily, src, style }) => {
  let fontSrc = src
  const content = tryReadFileMaybeLocal(src)
  if (content) {
    const ext = path.extname(src).slice(1)
    const mime =
      ext === 'woff'
        ? 'font/woff'
        : ext === 'woff2'
        ? 'font/woff2'
        : ext === 'ttf'
        ? 'font/ttf'
        : ext === 'otf'
        ? 'font/otf'
        : 'application/octet-stream'
    fontSrc = `data:${mime};base64,${content.toString('base64')}`
  }
  return (
    <style style={style}>{`
      @font-face {
        font-family: '${fontFamily}';
        src: url('${fontSrc}');
      }
    `}</style>
  )
}

// 6. SVG：本地自动内联SVG代码，其余直接img
export const SVG: React.FC<React.ImgHTMLAttributes<HTMLImageElement> & { src: string }> = ({
  src,
  ...props
}) => {
  const content = tryReadFileMaybeLocal(src)
  if (content) {
    // 直接内联SVG代码
    return <span dangerouslySetInnerHTML={{ __html: content.toString() }} {...props} />
  }
  return <img src={src} {...props} />
}

// 7. 音视频：本地自动 base64，其余直接 src
export const Media: React.FC<
  (React.AudioHTMLAttributes<HTMLAudioElement> | React.VideoHTMLAttributes<HTMLVideoElement>) & {
    src: string
    tag?: 'audio' | 'video'
  }
> = ({ src, tag = 'audio', ...props }) => {
  let realSrc = src
  const content = tryReadFileMaybeLocal(src)
  if (content) {
    const ext = path.extname(src).slice(1)
    const mime =
      tag === 'audio'
        ? `audio/${ext === 'mp3' ? 'mpeg' : ext}`
        : `video/${ext === 'mp4' ? 'mp4' : ext}`
    realSrc = `data:${mime};base64,${content.toString('base64')}`
  }
  if (tag === 'audio') return <audio src={realSrc} {...props} />
  return <video src={realSrc} {...props} />
}

// 8. JSON数据：本地自动内联，否则外链
export const JsonData: React.FC<{ src: string; id?: string }> = ({ src, id }) => {
  const content = tryReadFileMaybeLocal(src)
  if (content) {
    return (
      <script
        type="application/json"
        id={id}
        dangerouslySetInnerHTML={{ __html: content.toString() }}
      />
    )
  }
  // 外链JSON不建议直接输出，可用fetch异步获取
  return null
}

// 9. favicon/manifest等通用资源：本地自动 base64，其余外链
export const LinkRel: React.FC<{ rel: string; href: string }> = ({ rel, href, ...props }) => {
  let realHref = href
  const content = tryReadFileMaybeLocal(href)
  if (content) {
    const ext = path.extname(href).slice(1)
    let mime = ''
    if (ext === 'ico') mime = 'image/x-icon'
    else if (ext === 'png') mime = 'image/png'
    else if (ext === 'json') mime = 'application/json'
    else if (ext === 'webmanifest') mime = 'application/manifest+json'
    else mime = 'application/octet-stream'
    realHref = `data:${mime};base64,${content.toString('base64')}`
  }
  return <link rel={rel} href={realHref} {...props} />
}
