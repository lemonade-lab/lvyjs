import { Picture } from './utils/picture.js'
let pic: typeof Picture.prototype | null = null
/**
 * 得到一个 puppeteer 实例
 * @returns
 */
export const picture = async (restart = false) => {
  if (!pic || restart) {
    // 每次都new？
    pic = new Picture()
    // 启动浏览器
    await pic.puppeteer.start()
  }
  return pic
}
