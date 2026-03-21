import { Picture } from './utils/picture.js'

let pic: Picture | null = null
let picPromise: Promise<Picture | null> | null = null

/**
 * 得到一个 puppeteer 实例（并发安全，共享启动锁）
 * @param restart 是否重启实例
 * @returns Picture 实例
 */
export const picture = async (restart = false): Promise<Picture | null> => {
  if (pic && !restart) return pic
  // 并发调用共享同一个初始化流程
  if (picPromise) return picPromise
  picPromise = createPicture()
  try {
    return await picPromise
  } finally {
    picPromise = null
  }
}

async function createPicture(): Promise<Picture | null> {
  try {
    const p = new Picture()
    const started = await p.puppeteer.start()
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
