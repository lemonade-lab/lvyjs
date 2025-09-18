import { Picture } from './utils/picture.js'

let pic: Picture | null = null

/**
 * 得到一个 puppeteer 实例
 * @param restart 是否重启实例
 * @returns Picture 实例
 */
export const picture = async (restart = false): Promise<Picture | null> => {
  if (!pic || restart) {
    try {
      pic = new Picture()
      // 启动浏览器
      const started = await pic.puppeteer.start()
      if (!started) {
        console.error('[picture] failed to start browser')
        pic = null
        return null
      }
      console.info('[picture] instance created successfully')
    } catch (error) {
      console.error('[picture] failed to create instance:', error)
      pic = null
      return null
    }
  }
  return pic
}
