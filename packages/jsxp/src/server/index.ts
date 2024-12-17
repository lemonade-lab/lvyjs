import Koa from 'koa'
import KoaStatic from 'koa-static'
import Router from 'koa-router'
import { join } from 'path'
import mount from 'koa-mount'
import { Component } from '../component.js'
import { existsSync } from 'fs'
import { JSXPOptions } from '../types.js'
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
  const configs = ['jsxp.config.tsx', 'jsxp.config.jsx']

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

  const config = (await import(`file://${URI}`))?.default
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

  const KEY = Date.now()
  // 插入定时检查变化并刷新页面的 JS 代码
  const refreshScript = `
      <script>
        (function() {
          const checkForChanges = () => {
            fetch('/check-for-changes?key=${KEY}')  
              .then(response => response.json())
              .then(data => {
                if (data.hasChanges) {
                  // 如果接口返回了变化，则刷新页面
                  location.reload();
                }
              })
              .catch(err => console.error('jsxp 未响应:', err));
          };
    
          // 初次加载后每 1600 发送请求检查变化
          setInterval(checkForChanges, 1600);
        })();
      </script>
    `
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
  //

  //
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
        ...options,
        mountStatic: config?.mountStatic ?? '/file',
        create: false,
        server: true
      })

      //
      ctx.body = `${HTML}${refreshScript}`
    })
  }

  const PATH = process.cwd().replace(/\\/g, '\\\\')
  const mountStatic = config?.mountStatic ?? '/file'

  // static
  app.use(mount(mountStatic, KoaStatic(PATH)))

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
