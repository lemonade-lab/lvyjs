import { ComponentCreateOpsionType, RenderOptions } from './types.js'
import { picture } from './picture.js'

// 队列任务类型
type QueueTask =
  | {
      type: 'component'
      ComOptions: ComponentCreateOpsionType
      PupOptions?: RenderOptions
      resolve: (value: Buffer | false | null) => void
      reject: (reason?: any) => void
    }
  | {
      type: 'html'
      htmlContent: string
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

    if (task.type === 'component') {
      // 组件模式
      const result = await pic.screenshot(task.ComOptions, task.PupOptions)
      count = 0 // 重置错误计数
      // 完成任务 - 只返回Buffer，字符串地址转换为false
      if (Buffer.isBuffer(result)) {
        ;(task.resolve as (value: Buffer | false | null) => void)(result)
      } else {
        ;(task.resolve as (value: Buffer | false | null) => void)(false)
      }
    } else if (task.type === 'html') {
      // HTML模式
      const img = await pic.screenshotHtml(task.htmlContent, task.PupOptions)
      if (!img) {
        count++
        reject(new Error('Failed to capture screenshot'))
        return
      }
      count = 0 // 重置错误计数
      // 完成任务
      task.resolve(img)
    }
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
 * 添加HTML渲染任务到队列
 * @param htmlContent HTML内容字符串
 * @param PupOptions 渲染选项
 * @returns Promise<Buffer | null>
 */
export const renderHtmlQueue = async (
  htmlContent: string,
  PupOptions?: RenderOptions
): Promise<Buffer | null> => {
  return new Promise((resolve, reject) => {
    // 将HTML任务添加到队列
    queue.push({
      type: 'html',
      htmlContent,
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
