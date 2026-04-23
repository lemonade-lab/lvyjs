import Koa from 'koa'
import KoaStatic from 'koa-static'
import Router from 'koa-router'
import { join, normalize, dirname, extname } from 'path'
import { Component } from '../core/component.js'
import { existsSync } from 'fs'
import { stat as fsStat, readFile as fsReadFile } from 'fs/promises'
import { RouteOption } from '../types.js'
import send from 'koa-send'
import { createRefreshScript } from './refreshScript.js'
import {
  DYNAMIC_CACHE_MAX,
  rewriteServerUrls,
  SERVER_MIME,
  SERVER_TEXT_TYPES,
  STAT_TTL
} from './config.js'

/**
 * 动态加载
 * @param URL
 * @returns
 */
const _dynamicMtime = new Map<string, number>()
const _dynamicModule = new Map<string, any>()
const _dynamicStatAt = new Map<string, number>()

/**
 *
 * @param URL
 * @returns
 */
const Dynamic = async (URL: string) => {
  const now = Date.now()
  const lastCheck = _dynamicStatAt.get(URL) ?? 0
  // TTL 内直接返回缓存模块，跳过 fsStat
  if (now - lastCheck < STAT_TTL && _dynamicModule.has(URL)) {
    return _dynamicModule.get(URL)
  }
  const { mtimeMs } = await fsStat(URL)
  _dynamicStatAt.set(URL, now)
  // 文件未变化时复用缓存，避免模块图无限增长
  if (_dynamicMtime.get(URL) === mtimeMs && _dynamicModule.has(URL)) {
    return _dynamicModule.get(URL)
  }
  const modulePath = `file://${URL}?update=${mtimeMs}`
  const mod = (await import(modulePath))?.default
  // 淘汰最旧条目，防止内存累积
  if (_dynamicModule.size >= DYNAMIC_CACHE_MAX) {
    const oldest = _dynamicModule.keys().next().value
    if (oldest !== undefined) {
      _dynamicModule.delete(oldest)
      _dynamicMtime.delete(oldest)
      _dynamicStatAt.delete(oldest)
    }
  }
  _dynamicMtime.set(URL, mtimeMs)
  _dynamicModule.set(URL, mod)
  return mod
}

/**
 * 创建服务器
 * 监听配置文件中的路由，渲染组件并返回HTML
 * 支持静态文件服务和热更新检查
 * @param Port
 */
export async function createServer() {
  let URI = ''

  //
  const configs = [
    'jsxp.config.tsx',
    'jsxp.config.jsx',
    'jsxp.config.js',
    'jsxp.config.ts',
    'jsxp.config.mjs'
  ]

  for (const config of configs) {
    const dir = join(process.cwd(), config)
    if (existsSync(dir)) {
      URI = dir
      break
    }
  }

  if (!URI) {
    console.log('未找到配置文件jsxp.config.tsx')
    return
  }

  const config = await Dynamic(URI)
  if (!config) return

  const Com = new Component()
  const app = new Koa()
  const prefix = config?.prefix ?? ''
  const router = new Router({
    prefix
  })

  console.log('_______jsxp_______')

  const routes = config?.routes
  if (!routes) return

  // 当前时间戳
  const KEY = Date.now().toString()

  // 插入定时检查变化并刷新页面的 JS 代码
  const refreshScript = createRefreshScript(KEY, prefix)
  router.get('/check-for-changes', ctx => {
    const callback = String(ctx.query.callback || '__jsxp_cb').replace(/[^\w$.]/g, '')
    const key = Array.isArray(ctx.query.key) ? ctx.query.key[0] : ctx.query.key
    const hasChanges = key != KEY
    ctx.type = 'application/javascript'
    ctx.body = `${callback}(${JSON.stringify({ hasChanges })})`
  })

  // 文件请求 API
  const cwd = process.cwd()
  router.get('/_jsxp_file', async ctx => {
    const raw = ctx.query.path
    const filePath = Array.isArray(raw) ? raw[0] : raw
    if (!filePath) {
      ctx.status = 400
      ctx.body = { error: 'Missing "path" query parameter' }
      return
    }
    const fileURL = normalize(decodeURIComponent(filePath))
    // 限制在工作目录下，防止任意文件读取
    if (!fileURL.startsWith(cwd)) {
      ctx.status = 403
      ctx.body = { error: 'Access denied' }
      return
    }
    if (!existsSync(fileURL)) {
      ctx.status = 404
      ctx.body = { error: 'File not found' }
      return
    }
    try {
      const ext = extname(fileURL).slice(1).toLowerCase()
      // 文本类型文件：扫描 url() 引用并重写为 /_jsxp_file 路由
      if (SERVER_TEXT_TYPES.has(ext)) {
        const content = await fsReadFile(fileURL, 'utf-8')
        const rewritten = rewriteServerUrls(content, dirname(fileURL), prefix)
        ctx.type = SERVER_MIME[ext] || 'text/plain'
        ctx.body = rewritten
      } else {
        await send(ctx, fileURL, { root: '/' })
      }
    } catch (error) {
      console.error('Error sending file:', error)
      ctx.status = 500
      ctx.body = { error: 'Internal server error' }
    }
  })

  // 路由
  for (const url in routes) {
    console.log(`http://${config?.host ?? '127.0.0.1'}:${config?.port ?? 8080}${prefix + url}`)
    router.get(url, async ctx => {
      // 重新加载
      const config = await Dynamic(URI)
      // 不存在
      const routes = config?.routes
      if (!routes) return
      // 选择key
      const options = routes[url] as RouteOption
      if (!options) return
      const HTML = await Com.compile(options as any, 'server')
      ctx.body = `${HTML}${refreshScript}`
    })
  }

  // 静态文件
  const statics = config?.statics ?? 'public'
  if (Array.isArray(statics)) {
    for (const item of statics) {
      app.use(KoaStatic(item))
    }
  } else {
    app.use(KoaStatic(statics))
  }

  // routes
  app.use(router.routes())

  // listen 8000
  app.listen(config?.port ?? 8080, () => {
    console.log(`Server is running on port ${config?.port ?? 8080}`)
    console.log('自行调整默认浏览器尺寸 800 X 1280 100%')
    console.log('_______jsxp_______')
  })
}
