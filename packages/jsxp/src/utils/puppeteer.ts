import { Browser, Page, type PuppeteerLaunchOptions } from 'puppeteer'
import puppeteer from 'puppeteer'
import { promises as fsp } from 'fs'
import path from 'path'
import { RenderOptions } from '../types.js'

/**
 * MIME类型映射
 */
const MIME_MAP: Record<string, string> = {
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  wav: 'audio/wav',
  webm: 'video/webm',
  ico: 'image/x-icon'
}

/** 需要扫描内部 url() 引用的文本类型 */
const TEXT_TYPES = new Set(['css', 'html', 'htm', 'svg', 'js', 'mjs'])

/** url() 匹配正则 */
const CSS_URL_RE = /url\(["']?([^"')]+)["']?\)/g

/**
 * 扫描文本内容中的 url() 引用，将本地路径重写为 jsxp:// 协议
 * @param content 文件文本内容
 * @param fileDir 文件所在目录，用于解析相对路径
 */
function rewriteLocalUrls(content: string, fileDir: string): string {
  return content.replace(CSS_URL_RE, (match, ref: string) => {
    // 跳过 web 协议、data URI、已改写的 jsxp://
    if (/^(https?:|data:|blob:|jsxp:|#)/i.test(ref)) return match
    // 解析为绝对路径（支持相对路径和绝对路径）
    const absPath = path.resolve(fileDir, ref)
    return `url(jsxp://${encodeURIComponent(absPath)})`
  })
}

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
  headless: true, // 无头模式
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
  // 状态
  #isBrowser = false

  // 配置
  #launch: PuppeteerLaunchOptions = { ...PuppeteerDefineOptioins }

  // 应用缓存
  browser: Browser | null = null

  // Page 对象池，复用已创建的页面避免反复 newPage 开销
  #pagePool: Page[] = []
  #MAX_POOL_SIZE = 6

  // jsxp:// 文件读取缓存，同一渲染周期内去重磁盘读取
  #fileReadCache = new Map<string, Promise<Buffer>>()
  // 每个 Page 的使用计数，超过阈值则淘汰重建，避免内存累积
  #pageUseCount = new WeakMap<Page, number>()
  #PAGE_MAX_USES = 50

  // 启动锁，防止并发重启竞态
  #startPromise: Promise<boolean> | null = null

  /**
   * 将截图结果转为 Buffer
   */
  #toBuffer(buff: Uint8Array | Buffer | string | void, encoding?: BufferEncoding): Buffer | null {
    if (!buff) return null
    if (Buffer.isBuffer(buff)) return buff
    if (buff instanceof Uint8Array)
      return Buffer.from(buff.buffer, buff.byteOffset, buff.byteLength)
    if (typeof buff === 'string') {
      if (buff.startsWith('data:')) {
        const base64Data = buff.split(',')[1] || ''
        return Buffer.from(base64Data, 'base64')
      }
      return Buffer.from(buff, encoding)
    }
    return null
  }

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
   * 确保浏览器已启动，断连时自动重启
   */
  async isStart() {
    if (this.#isBrowser && this.browser?.connected) {
      return true
    }
    // 并发调用共享同一个启动流程，避免重复重启
    if (this.#startPromise) return this.#startPromise
    this.#startPromise = this.#doRestart()
    try {
      return await this.#startPromise
    } finally {
      this.#startPromise = null
    }
  }

  async #doRestart() {
    // 清空池中的旧页面引用
    this.#pagePool = []
    this.#isBrowser = false
    if (this.browser) {
      await this.browser.close().catch(() => {})
      this.browser = null
    }
    return this.start()
  }

  /**
   * 从池中获取可用 Page，池为空时创建新 Page 并注册拦截
   */
  async #acquirePage(): Promise<Page | null> {
    while (this.#pagePool.length > 0) {
      const page = this.#pagePool.pop()!
      if (!page.isClosed()) return page
    }
    const page = await this.browser?.newPage()
    if (!page) return null
    await page.setRequestInterception(true)
    page.on('request', async req => {
      try {
        const url = req.url()
        if (url.startsWith('jsxp://')) {
          let localPath = decodeURIComponent(url.replace(/^jsxp:\/\//, ''))
          if (/^\/[A-Za-z]:\//.test(localPath)) localPath = localPath.slice(1)
          try {
            // 缓存文件读取，同一文件只读一次磁盘
            if (!this.#fileReadCache.has(localPath)) {
              this.#fileReadCache.set(localPath, fsp.readFile(localPath))
            }
            const buf = await this.#fileReadCache.get(localPath)!
            const ext = path.extname(localPath).slice(1).toLowerCase()
            // 文本类型文件扫描 url() 引用，重写为 jsxp:// 确保嵌套资源也走拦截
            let body: Buffer | string = buf
            if (TEXT_TYPES.has(ext)) {
              const fileDir = path.dirname(localPath)
              body = rewriteLocalUrls(buf.toString('utf-8'), fileDir)
            }
            await req.respond({
              status: 200,
              contentType: MIME_MAP[ext] || 'application/octet-stream',
              body
            })
          } catch {
            console.warn('[puppeteer] local file not found:', localPath)
            this.#fileReadCache.delete(localPath)
            await req.respond({ status: 404, body: 'Not found' })
          }
          return
        }
        await req.continue()
      } catch {
        // 页面已关闭或请求已处理
      }
    })
    return page
  }

  /**
   * 归还 Page 到池中复用，超出上限或使用次数过多则关闭
   */
  async #releasePage(page: Page) {
    if (page.isClosed()) return
    const uses = (this.#pageUseCount.get(page) ?? 0) + 1
    this.#pageUseCount.set(page, uses)
    if (uses >= this.#PAGE_MAX_USES || this.#pagePool.length >= this.#MAX_POOL_SIZE) {
      await page.close().catch(() => {})
    } else {
      this.#pagePool.push(page)
    }
  }

  /**
   * 渲染HTML并截图
   * 使用 Page 池 + setContent + jsxp:// 异步请求拦截
   */
  async render(html: string, Options?: RenderOptions) {
    if (!(await this.isStart())) return null
    // 每次渲染清空文件缓存，避免跨渲染累积
    this.#fileReadCache.clear()
    const page = await this.#acquirePage()
    if (!page) return null
    const { goto, selector, screenshot, bufferFromEncoding } = Options ?? {}

    try {
      await page.setContent(html, {
        waitUntil: 'load',
        timeout: 60000,
        ...(goto ?? {})
      })

      const body = await page.$(selector ?? 'body')
      if (!body) return null

      console.info('[puppeteer] success')
      const buff = await body.screenshot({ type: 'png', ...(screenshot ?? {}) })
      return this.#toBuffer(buff, bufferFromEncoding)
    } catch (err) {
      await page.close().catch(() => {})
      throw err
    } finally {
      if (!page.isClosed()) {
        await this.#releasePage(page)
      }
    }
  }
}
