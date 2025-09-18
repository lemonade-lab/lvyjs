import React, { ComponentType } from 'react'
import { ComponentCreateOpsionType, RenderOptions, RendersType } from './types.js'
import { getProcessing, queue, renderQueue, renderHtmlQueue } from './queue.js'
import { picture } from './picture.js'
import { renderToString } from 'react-dom/server'
/**
 * 渲染组件为图片
 * @param ComOptions 组件选项
 * @param PupOptions 渲染选项
 */
export const render = async (
  ComOptions: ComponentCreateOpsionType,
  PupOptions?: RenderOptions
): Promise<Buffer | false> => {
  // 如果 puppeteer 尚未初始化，则进行初始化
  // 返回一个 Promise
  return new Promise((resolve, reject) => {
    // 将任务添加到队列
    queue.push({
      type: 'component',
      ComOptions,
      PupOptions,
      resolve,
      reject
    })
    // 如果没有任务正在进行，则开始处理队列
    if (!getProcessing()) {
      renderQueue()
    }
  })
}

/**
 * 对组件 map 进行合并渲染
 * @deprecated 废弃，请使用 renderComponentToBuffer
 * @param Components
 * @returns
 */
export const renders: RendersType = Components => {
  console.warn('[jsxp] renders function is deprecated, please use renderComponentToBuffer instead')
  return async (key, props, name) => {
    // 选择组件
    const Component = Components[key]
    const k = String(key)
    // 确保 MyComponent 是有效的组件
    if (!Component) {
      throw new Error(`Component with key "${k}" does not exist.`)
    }
    // 截图
    return render({
      path: k,
      name: `${name ?? k}.html`,
      component: <Component {...props} />
    })
  }
}

/**
 * @param name 组件名
 * @param Component 组件（React 组件类型）
 * @param props 参数（组件的 props 类型）
 * @returns
 */
export const renderComponentToBuffer = <P extends Record<string, unknown>>(
  name: string,
  Component: ComponentType<P>,
  props: P
) => {
  // 截图
  return render({
    path: name,
    name: 'index.html',
    component: <Component {...props} />
  })
}

export const renderComponentIsHtmlToBuffer = <P extends Record<string, unknown>>(
  Component: ComponentType<P>,
  props: P,
  PupOptions?: RenderOptions
) => {
  // 截图
  return renderHtmlQueue(`<!DOCTYPE html>${renderToString(<Component {...props} />)}`, PupOptions)
}

/**
 * 纯HTML模式渲染（使用队列）
 * @param htmlContent HTML内容字符串
 * @param PupOptions 渲染选项
 * @returns 截图Buffer或null
 */
export const renderHtmlToBuffer = async (
  htmlContent: string,
  PupOptions?: RenderOptions
): Promise<Buffer | null> => {
  return await renderHtmlQueue(htmlContent, PupOptions)
}

/**
 * 纯HTML模式渲染（直接渲染，不使用队列）
 * @param htmlContent HTML内容字符串
 * @param PupOptions 渲染选项
 * @returns 截图Buffer或null
 */
export const renderHtmlToBufferDirect = async (
  htmlContent: string,
  PupOptions?: RenderOptions
): Promise<Buffer | null> => {
  const pic = await picture()
  if (!pic) return null
  return await pic.screenshotHtml(htmlContent, PupOptions)
}
