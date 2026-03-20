import { ComponentCreateOpsionType, RenderOptions } from './types.js'
import { picture } from './picture.js'

// 队列任务类型
type QueueTask = {
  ComOptions: ComponentCreateOpsionType
  PupOptions?: RenderOptions
  resolve: (value: Buffer | null) => void
  reject: (reason?: any) => void
}

// 队列
export const queue: QueueTask[] = []

// 标志
let isProcessing = false

// 并发控制
const MAX_CONCURRENT = 3
let currentConcurrent = 0

export const setProcessing = (bool: boolean) => {
  isProcessing = bool
}

export const getProcessing = () => isProcessing

export const getCurrentConcurrent = () => currentConcurrent

export const canProcessMore = () => currentConcurrent < MAX_CONCURRENT

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

  // 检查并发限制
  if (!canProcessMore()) {
    console.info('[queue] max concurrent reached, waiting...')
    return
  }

  // 设置标志
  isProcessing = true
  currentConcurrent++

  // 得到队列中的第一个任务
  const task = queue.shift()
  if (!task) return

  const { reject } = task

  try {
    const pic = await picture()
    if (!pic) {
      reject(new Error('Failed to initialize picture instance'))
      return
    }

    const result = await pic.screenshot(task.ComOptions, task.PupOptions)
    count = 0
    task.resolve(result as Buffer | null)
  } catch (error) {
    count++
    console.error('[queue] render error:', error)
    // 拒绝任务
    reject(error)
    // 如果错误次数超过1次，重启浏览器
    if (count > 1) {
      console.info('[queue] restarting browser due to repeated errors')
      await picture(true) // 重启浏览器
    }
  } finally {
    currentConcurrent--
  }

  // 处理下一个任务
  renderQueue()
}

/**
 * 添加渲染任务到队列
 * @param ComOptions 组件选项
 * @param PupOptions 渲染选项
 * @returns Promise<Buffer | null>
 */
export const addToQueue = async (
  ComOptions: ComponentCreateOpsionType,
  PupOptions?: RenderOptions
): Promise<Buffer | null> => {
  return new Promise((resolve, reject) => {
    queue.push({
      ComOptions,
      PupOptions,
      resolve,
      reject
    })
    if (!getProcessing()) {
      renderQueue()
    }
  })
}
