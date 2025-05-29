import { ComponentCreateOpsionType, RenderOptions } from './types.js'
import { picture } from './picture.js'

// 队列
export const queue: {
  ComOptions: ComponentCreateOpsionType
  PupOptions?: RenderOptions
  resolve: Function
  reject: Function
}[] = []

// 标志
let isProcessing = false

export const setProcessing = (bool: boolean) => {
  isProcessing = bool
}

export const getProcessing = () => isProcessing

let count = 0

/**
 * 处理队列
 * @returns
 */
export const renderQueue = async () => {
  if (queue.length === 0) {
    isProcessing = false
    return
  }
  // 设置标志
  isProcessing = true
  // 得到队列中的第一个任务
  const { ComOptions, PupOptions, resolve } = queue.shift()
  try {
    const pic = await picture()
    if (!pic) {
      resolve(null)
      return
    }
    const img = await pic.screenshot(ComOptions, PupOptions)
    count = 0 // 重置错误计数
    // 完成任务
    resolve(img)
  } catch (error) {
    count++
    console.error(error)
    // 拒绝任务
    resolve(null)
    // 如果错误次数超过1次，重启浏览器
    if (count > 1) {
      await picture(true) // 重启浏览器
    }
  }
  // 处理下一个任务
  renderQueue()
}
