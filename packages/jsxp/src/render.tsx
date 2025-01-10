import React from 'react'
import { ComponentCreateOpsionType, ObtainProps, ScreenshotFileOptions } from './types.js'
import { picture } from './picture.js'

// 队列
const queue: {
  ComOptions: ComponentCreateOpsionType
  PupOptions?: ScreenshotFileOptions
  resolve: Function
  reject: Function
}[] = []

// 标志
let isProcessing = false

/**
 * 处理队列
 * @returns
 */
const processQueue = async () => {
  if (queue.length === 0) {
    isProcessing = false
    return
  }
  // 设置标志
  isProcessing = true
  // 得到队列中的第一个任务
  const { ComOptions, PupOptions, resolve, reject } = queue.shift()
  try {
    const pic = await picture()
    if (!pic) {
      reject(false)
      return
    }
    const img = await pic.screenshot(ComOptions, PupOptions)
    // 完成任务
    resolve(img)
  } catch (error) {
    console.error(error)
    // 拒绝任务
    reject(false)
  }
  // 处理下一个任务
  processQueue()
}

/**
 * 渲染组件为图片
 * @param htmlPath
 * @param options
 */
export const render = async (
  ComOptions: ComponentCreateOpsionType,
  PupOptions?: ScreenshotFileOptions
): Promise<Buffer | false> => {
  // 如果 puppeteer 尚未初始化，则进行初始化
  // 返回一个 Promise
  return new Promise((resolve, reject) => {
    // 将任务添加到队列
    queue.push({ ComOptions, PupOptions, resolve, reject })
    // 如果没有任务正在进行，则开始处理队列
    if (!isProcessing) {
      processQueue()
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
