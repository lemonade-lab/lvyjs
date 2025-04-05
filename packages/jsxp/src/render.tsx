import React, { ComponentType } from 'react'
import { ComponentCreateOpsionType, ObtainProps, RenderOptions } from './types.js'
import { getProcessing, queue, renderQueue } from './queue.js'

/**
 * 渲染组件为图片
 * @param htmlPath
 * @param options
 */
export const render = async (
  ComOptions: ComponentCreateOpsionType,
  PupOptions?: RenderOptions
): Promise<Buffer | false> => {
  // 如果 puppeteer 尚未初始化，则进行初始化
  // 返回一个 Promise
  return new Promise((resolve, reject) => {
    // 将任务添加到队列
    queue.push({ ComOptions, PupOptions, resolve, reject })
    // 如果没有任务正在进行，则开始处理队列
    if (!getProcessing()) {
      renderQueue()
    }
  })
}

type RendersType = <
  ComponentsType extends Record<string, React.FC<any> | React.ComponentClass<any>>
>(
  Components: ComponentsType
) => <TKey extends keyof ComponentsType>(
  /**
   * 组件 key
   */
  key: TKey,
  /**
   * 组件 props
   */
  options: ObtainProps<ComponentsType[TKey]>,
  /**
   * 文件名名。默认为组件key
   */
  name?: string
) => Promise<false | Buffer>

/**
 * 对组件 map 进行合并渲染
 * 废弃
 * @deprecated 废弃，请使用 renderComponentToBuffer
 * @param Components
 * @returns
 */
export const renders: RendersType = Components => {
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
