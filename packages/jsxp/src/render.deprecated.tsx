import React, { ComponentType } from 'react'
import { RendersType } from './types.js'
import { render } from './render.js'

/**
 * 对组件 map 进行合并渲染
 * @deprecated 废弃，请使用 renderComponentToBuffer
 * @param Components
 * @returns
 */
export const renders: RendersType = Components => {
  console.warn('[jsxp] renders function is deprecated, please use renderComponentToBuffer instead')
  return async (key, props, _name) => {
    const Component = Components[key]
    const k = String(key)
    if (!Component) {
      throw new Error(`Component with key "${k}" does not exist.`)
    }
    return render({
      component: <Component {...props} />
    })
  }
}

/**
 * 渲染组件为图片Buffer
 * @param name 组件名（仅标识用途）
 * @param Component 组件
 * @param props 组件 props
 * @returns 截图Buffer或null
 * @deprecated 废弃，请使用 renderComponentIsHtmlToBuffer、renderHtmlToBuffer、renderElement 等更明确的函数替代
 */
export const renderComponentToBuffer = <P extends Record<string, unknown>>(
  _name: string,
  Component: ComponentType<P>,
  props: P
) => {
  return render({
    component: <Component {...props} />
  })
}
