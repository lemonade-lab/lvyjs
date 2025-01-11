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
  renderQueue()
}
