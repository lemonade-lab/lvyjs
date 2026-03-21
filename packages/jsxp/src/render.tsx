import React, { ComponentType } from 'react'
import { ComponentCreateOpsionType, RenderOptions, RendersType } from './types.js'
import { addToQueue } from './queue.js'

/**
 * 渲染组件为图片
 * @param ComOptions 组件选项
 * @param PupOptions 渲染选项
 */
export const render = async (
  ComOptions: ComponentCreateOpsionType,
  PupOptions?: RenderOptions
): Promise<Buffer | null> => {
  return addToQueue(ComOptions, PupOptions)
}

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

/**
 * 渲染组件为图片Buffer
 * @param Component 组件
 * @param props 组件 props
 * @param PupOptions 渲染选项
 * @returns 截图Buffer或null
 */
export const renderComponentIsHtmlToBuffer = <P extends Record<string, unknown>>(
  Component: ComponentType<P>,
  props: P,
  PupOptions?: RenderOptions
) => {
  return render({ component: <Component {...props} /> }, PupOptions)
}

/**
 * 纯HTML模式渲染
 * @param htmlContent HTML内容字符串
 * @param PupOptions 渲染选项
 * @returns 截图Buffer或null
 */
export const renderHtmlToBuffer = async (
  htmlContent: string,
  PupOptions?: RenderOptions
): Promise<Buffer | null> => {
  return render({ html: htmlContent }, PupOptions)
}

/**
 * element + propsCall 模式渲染
 * propsCall 的返回值类型由 element 的 props 自动推导
 * @param element 组件类型
 * @param propsCall 获取 props 的函数
 * @param PupOptions 渲染选项
 * @returns 截图Buffer或null
 */
export const renderElement = <P extends Record<string, any>>(
  element: ComponentType<P>,
  propsCall?: () => P | Promise<P>,
  PupOptions?: RenderOptions
): Promise<Buffer | null> => {
  return render({ element, propsCall } as ComponentCreateOpsionType, PupOptions)
}
