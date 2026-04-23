import { ComponentCreateOptionsType, RenderOptions } from '../../types.js'
import { picture } from './createPicture.js'
import { shouldRestartBrowser } from './shared.js'

type QueueTask = {
  ComOptions: ComponentCreateOptionsType
  PupOptions?: RenderOptions
  resolve: (value: Buffer | null) => void
  reject: (reason?: any) => void
}

export const queue: QueueTask[] = []

let isProcessing = false

const MAX_CONCURRENT = 6
let currentConcurrent = 0

export const setProcessing = (bool: boolean) => {
  isProcessing = bool
}

export const getProcessing = () => isProcessing

export const getCurrentConcurrent = () => currentConcurrent

export const canProcessMore = () => currentConcurrent < MAX_CONCURRENT

let browserErrorCount = 0

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

const processTask = async (task: QueueTask) => {
  try {
    const pic = await picture(false, task.PupOptions?.preferredEngine)
    if (!pic) {
      task.reject(new Error('Failed to initialize picture instance'))
      return
    }

    const result = await pic.screenshot(task.ComOptions, task.PupOptions)
    browserErrorCount = 0
    task.resolve(result as Buffer | null)
  } catch (error) {
    console.error('[queue] render error:', error)
    task.reject(error)
    if (!shouldRestartBrowser(error)) {
      browserErrorCount = 0
      return
    }

    browserErrorCount++
    if (browserErrorCount > 1) {
      console.info('[queue] restarting browser due to repeated browser errors')
      await picture(true, task.PupOptions?.preferredEngine)
    }
  } finally {
    currentConcurrent--
    renderQueue()
  }
}

export const addToQueue = (
  ComOptions: ComponentCreateOptionsType,
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
