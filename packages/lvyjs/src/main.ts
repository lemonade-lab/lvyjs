import module from 'node:module'
import { MessageChannel } from 'node:worker_threads'
import { initConfig } from './store'
import { postCSS } from './postcss'
import { assetsRegExp, stylesRegExp } from './config'
if (!module.register) {
  throw new Error(
    `This version of Node.js (${process.version}) does not support module.register(). Please upgrade to Node v18.19 or v20.6 and above.`
  )
}
if (process.env?.__LVYJS_REGISTER_CONFIG) {
  const configValues = JSON.parse(process.env.__LVYJS_REGISTER_CONFIG)
  // 进行深度转换，将带有 __regexp 标记的对象转换为 RegExp 实例
  const convertConfig = (obj: any): any => {
    if (obj && typeof obj === 'object') {
      if (obj.__regexp) {
        return new RegExp(obj.source, obj.flags)
      }
      const newObj: any = Array.isArray(obj) ? [] : {}
      for (const key in obj) {
        newObj[key] = convertConfig(obj[key])
      }
      return newObj
    }
    return obj
  }
  global.lvyConfig = convertConfig(configValues)
} else {
  await initConfig()
}
const { port1, port2 } = new MessageChannel()
const cache = {}
port1.on('message', msg => {
  if (msg.type == 'CSS_MODULE_GENERATED') {
    const { from, to } = msg.payload
    if (!cache[from]) {
      const formPath = decodeURIComponent(from)
      postCSS(formPath, to)
      // postCSS(from, to)
      cache[from] = true
    }
  }
})
// port1.unref()
module.register('./loader.js', {
  parentURL: import.meta.url,
  data: {
    port: port2,
    lvyConfig: {
      alias: global.lvyConfig?.alias,
      assets: global.lvyConfig?.assets ?? {
        filter: assetsRegExp
      },
      styles: global.lvyConfig?.styles ?? {
        filter: stylesRegExp
      }
    }
  },
  transferList: [port2]
})
