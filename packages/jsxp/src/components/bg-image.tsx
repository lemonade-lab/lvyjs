import React, { type CSSProperties } from 'react'

/**
 * div扩展组件类型
 */
type DivBackgroundImageProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> & {
  /**
   * 废弃
   * @deprecated
   */
  url?: string | string[]
  /**
   * The style CSS 属性是一个对象，其中包含应用于元素的 CSS 属性。
   */
  src?: string | string[]
  /**
   * The background-size CSS 属性设置元素背景图像的大小。图像可以保留其自然大小、拉伸或约束以适合可用空间。
   */
  size?: CSSProperties['backgroundSize']
}

export const BackgroundImage = (props: DivBackgroundImageProps) => {
  let { src, url, size = '100% auto', style, ...rest } = props
  if (url) src = url
  return (
    <div
      style={{
        backgroundImage: Array.isArray(src)
          ? src.map(url => `url(${url})`).join(',')
          : `url(${src})`,
        backgroundSize: size,
        ...style
      }}
      {...rest}
    />
  )
}
