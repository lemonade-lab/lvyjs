import { Picture } from './picture.js'
import type { BrowserEngine } from '../../types.js'

let pic: Picture | null = null
let picPromise: Promise<Picture | null> | null = null

/**
 * 得到一个浏览器实例（并发安全，共享启动锁）
 * @param restart 是否重启实例
 * @param preferredEngine 首选渲染引擎
 * @returns Picture 实例
 */
export const picture = async (
  restart = false,
  preferredEngine?: BrowserEngine
): Promise<Picture | null> => {
  if (pic && !restart) {
    if (!preferredEngine || pic.getPreferredEngine() === preferredEngine) {
      return pic
    }
  }

  if (picPromise) return picPromise
  picPromise = createPicture(preferredEngine)
  try {
    return await picPromise
  } finally {
    picPromise = null
  }
}

async function createPicture(preferredEngine?: BrowserEngine): Promise<Picture | null> {
  try {
    const p = new Picture(undefined, preferredEngine)
    const started = await p.browser.start()
    if (!started) {
      console.error('[picture] failed to start browser')
      return null
    }
    console.info('[picture] instance created successfully')
    pic = p
    return pic
  } catch (error) {
    console.error('[picture] failed to create instance:', error)
    pic = null
    return null
  }
}
