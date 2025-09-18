import { Browser, type PuppeteerLaunchOptions } from 'puppeteer'
import puppeteer from 'puppeteer'
import { RenderOptions } from '../types.js'

/**
 * 默认参数配置
 */
export const PuppeteerDefineOptioins = {
  // 禁用超时
  timeout: 0, //otocolTimeout: 0,
  // 请求头
  headless: true,
  //
  args: [
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
    '--no-first-run',
    '--no-sandbox',
    '--no-zygote',
    '--single-process'
  ]
  // executablePath: ''
  // BOT浏览器默认尺寸 753 X 1180
}

/**
 * 无头浏览器配置
 */
export const PuppeteerOptimizeOptioins: PuppeteerLaunchOptions = {
  timeout: 0, //otocolTimeout: 0,
  headless: true,
  args: [
    '--disable-dev-shm-usage', // 禁用 /dev/shm 的使用，防止共享内存不足的问题
    '--disable-setuid-sandbox', // 禁用 setuid 沙盒
    '--no-first-run', // 跳过首次运行的设置
    '--no-sandbox', // 禁用沙盒模式
    '--no-zygote', // 禁用 zygote 进程
    '--single-process', // 使浏览器在单个进程中运行
    '--disable-background-networking', // 禁用后台网络请求
    '--disable-background-timer-throttling', // 禁用后台计时器节流
    '--disable-backgrounding-occluded-windows', // 禁用后台窗口
    '--disable-breakpad', // 禁用崩溃报告
    '--disable-client-side-phishing-detection', // 禁用客户端钓鱼检测
    '--disable-component-update', // 禁用组件更新
    '--disable-default-apps', // 禁用默认应用
    '--disable-domain-reliability', // 禁用域名可靠性
    '--disable-extensions', // 禁用扩展
    '--disable-features=AudioServiceOutOfProcess', // 禁用音频服务进程外处理
    '--disable-hang-monitor', // 禁用挂起监视器
    '--disable-ipc-flooding-protection', // 禁用 IPC 洪水保护
    '--disable-popup-blocking', // 禁用弹出窗口阻止
    '--disable-print-preview', // 禁用打印预览
    '--disable-prompt-on-repost', // 禁用重新发布提示
    '--disable-renderer-backgrounding', // 禁用渲染器后台处理
    '--disable-sync', // 禁用同步
    '--force-color-profile=srgb', // 强制使用 sRGB 颜色配置文件
    '--metrics-recording-only', // 仅记录指标
    '--safebrowsing-disable-auto-update', // 禁用安全浏览自动更新
    '--enable-automation', // 启用自动化
    '--password-store=basic', // 使用基本密码存储
    '--use-mock-keychain' // 使用模拟密钥链
  ]
}

/**
 * 无头浏览器
 */
export class Puppeteer {
  // 截图次数记录
  #pic = 0

  // 重启次数控制
  #restart = 200

  // 状态
  #isBrowser = false

  // 配置
  #launch: PuppeteerLaunchOptions = { ...PuppeteerDefineOptioins }

  // 应用缓存
  browser: Browser = null

  /**
   * 读取浏览器地址
   * 未配置将使用内置的自动查询流
   */
  constructor(launch?: PuppeteerLaunchOptions) {
    if (launch) {
      this.#launch = {
        ...launch,
        ...this.#launch
      }
    }
  }

  /**
   * 设置
   * @param val
   */
  setLaunch(val: PuppeteerLaunchOptions) {
    this.#launch = val
    return this
  }

  /**
   * 获取
   * @returns
   */
  getLaunch(): PuppeteerLaunchOptions {
    return this.#launch
  }

  /**
   * 启动pup
   * @returns
   */
  async start() {
    try {
      this.browser = await puppeteer.launch(this.#launch)
      this.#isBrowser = true
      // console.info('[puppeteer] open success')
      return true
    } catch (err) {
      this.#isBrowser = false
      console.error('[puppeteer] err', err)
      return false
    }
  }
  /**
   * 启动pup检查
   * @returns 是否启动成功
   */
  async isStart() {
    /**
     * 检测是否开启
     */
    if (!this.#isBrowser) {
      const T = await this.start()
      if (!T) return false
    }
    if (this.#pic <= this.#restart) {
      /**
       * 记录次数
       */
      this.#pic++
    } else {
      /**
       * 重置次数
       */
      this.#pic = 0
      console.info('[puppeteer] close')
      this.#isBrowser = false
      this.browser?.close().catch(err => {
        console.error('[puppeteer] close', err)
      })
      console.info('[puppeteer] reopen')
      if (!(await this.start())) return false
      this.#pic++
    }
    return true
  }

  /**
   *
   * @param html
   * @param Options
   * @returns
   */
  async render(html: string, Options?: RenderOptions) {
    const T = await this.isStart()
    if (!T) return null
    const page = await this.browser?.newPage()
    if (!page) return null
    const { goto, selector, screenshot, isHtmlContent, bufferFromEncoding } = Options ?? {}
    if (isHtmlContent) {
      await page.setContent(html, {
        waitUntil: 'networkidle2',
        timeout: 12000,
        ...(goto ?? {})
      })
    } else {
      await page.goto(`file://${html}`, {
        waitUntil: 'networkidle2',
        timeout: 12000,
        ...(goto ?? {})
      })
    }
    const body = await page.$(selector ?? 'body')
    if (!body) return null
    console.info('[puppeteer] success')
    const buff = await body.screenshot({
      type: 'png',
      ...(screenshot ?? {})
    })
    await page.close()
    if (!buff) return null
    if (buff instanceof Uint8Array) {
      return Buffer.from(buff)
    } else if (Buffer.isBuffer(buff)) {
      return buff
    } else if (typeof buff === 'string') {
      const curbuff = buff as string
      // base64
      if (curbuff.startsWith('data:')) {
        const base64Data = curbuff.split(',')[1] || ''
        return Buffer.from(base64Data, 'base64')
      }
      return Buffer.from(buff, bufferFromEncoding)
    }
    return null
  }

  /**
   *
   * @param htmlContent
   * @param Options
   * @returns
   */
  renderHtml(htmlContent: string, Options?: RenderOptions) {
    return this.render(htmlContent, { ...Options, isHtmlContent: true })
  }
}
