import React from 'react'
import { readFileSync } from 'fs'

/**
 * 引入 ESM 文件
 * @param param0
 * @returns
 */
export const LinkESM = (
  props: React.DetailedHTMLProps<
    React.ScriptHTMLAttributes<HTMLScriptElement>,
    HTMLScriptElement
  > & {
    src: string
  }
) => {
  const { children, src, ...rest } = props
  return <script type="module" src={src} {...rest} />
}

/**
 * 读取文件内容并作为 ESM 文件引入
 * @param param0
 * @returns
 */
export const LinkESMFile = (
  props: React.DetailedHTMLProps<
    React.ScriptHTMLAttributes<HTMLScriptElement>,
    HTMLScriptElement
  > & {
    src: string
  }
) => {
  const { src, ...rest } = props
  try {
    const data = readFileSync(src, 'utf-8')
    return (
      <script type="module" {...rest}>
        {data}
      </script>
    )
  } catch (e) {
    return <></>
  }
}
