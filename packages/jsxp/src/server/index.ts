import Koa from 'koa'
import KoaStatic from 'koa-static'
import Router from 'koa-router'
import { join } from 'path'
import { Component } from '../utils/component.js'
import { existsSync } from 'fs'
import { JSXPOptions } from '../types.js'
import send from 'koa-send'
import { createRefreshScript } from './refreshScript.js'

/**
 * 动态加载
 * @param URL
 * @returns
 */
const Dynamic = async (URL: string) => {
  const modulePath = `file://${URL}?update=${Date.now()}`
  return (await import(modulePath))?.default
}

/**
 *
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
  const KEY = Date.now()

  // 插入定时检查变化并刷新页面的 JS 代码
  const refreshScript = createRefreshScript(KEY)
  router.get('/check-for-changes', ctx => {
    if (ctx.request.query?.key == KEY) {
      ctx.body = {
        hasChanges: false
      }
    } else {
      ctx.body = {
        hasChanges: true
      }
    }
  })

  // 文件请求 API
  router.get('/files', async ctx => {
    const filePath = ctx.query.path // 获取请求中的路径参数
    if (!filePath) {
      ctx.status = 400
      ctx.body = { error: 'Missing "path" query parameter' }
      return
    }
    const fileURL = decodeURIComponent(filePath) // 解码路径
    // 检查文件是否存在
    if (!existsSync(fileURL)) {
      ctx.status = 404
      ctx.body = { error: 'File not found' }
      return
    }
    try {
      // 发送文件内容
      await send(ctx, fileURL, { root: '/' })
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
      const options = routes[url] as JSXPOptions['routes']['']
      // 丢失了
      if (!options) return
      // options
      const HTML = Com.compile({
        component: options.component,
        create: false,
        server: true
      })
      // 内容
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
