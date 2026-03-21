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

// 并发控制（与 Puppeteer Page 池大小对齐）
const MAX_CONCURRENT = 6
let currentConcurrent = 0

export const setProcessing = (bool: boolean) => {
  isProcessing = bool
}

export const getProcessing = () => isProcessing

export const getCurrentConcurrent = () => currentConcurrent

export const canProcessMore = () => currentConcurrent < MAX_CONCURRENT

let count = 0

/**
 * 排空队列，启动尽可能多的并发任务
 */
export const renderQueue = () => {
  while (queue.length > 0 && canProcessMore()) {
    const task = queue.shift()!
    currentConcurrent++
    isProcessing = true
    processTask(task)
  }
  if (queue.length === 0 && currentConcurrent === 0) {
    isProcessing = false
  }
}

/**
 * 处理单个渲染任务
 */
const processTask = async (task: QueueTask) => {
  try {
    const pic = await picture()
    if (!pic) {
      task.reject(new Error('Failed to initialize picture instance'))
      return
    }

    const result = await pic.screenshot(task.ComOptions, task.PupOptions)
    count = 0
    task.resolve(result as Buffer | null)
  } catch (error) {
    count++
    console.error('[queue] render error:', error)
    task.reject(error)
    if (count > 1) {
      console.info('[queue] restarting browser due to repeated errors')
      await picture(true)
    }
  } finally {
    currentConcurrent--
    // 无递归，通过事件循环调度下一批任务
    renderQueue()
  }
}

/**
 * 添加渲染任务到队列
 * @param ComOptions 组件选项
 * @param PupOptions 渲染选项
 * @returns Promise<Buffer | null>
 */
export const addToQueue = (
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
    renderQueue()
  })
}
