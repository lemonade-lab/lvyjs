import module from 'node:module'
import { MessageChannel } from 'node:worker_threads'
import { postCSS } from './postcss'
if (!module.register) {
  throw new Error(
    `This version of Node.js (${process.version}) does not support module.register(). Please upgrade to Node v18.19 or v20.6 and above.`
  )
}
const { port1, port2 } = new MessageChannel()
const cache = {}
port1.on('message', msg => {
  if (msg.type == 'CSS_MODULE_GENERATED') {
    const { from, to } = msg.payload
    if (!cache[from]) {
      postCSS(from, to)
      cache[from] = true
    }
  } else if (msg.type == 'JS_MODULE_GENERATED') {
    // load 要对 指定目录下的文件，进行监听，并启动热加载。
  }
})
// port1.unref()
module.register('./loader.js', {
  parentURL: import.meta.url,
  data: {
    port: port2,
    lvyConfig: {
      alias: global.lvyConfig.alias,
      assets: global.lvyConfig.assets,
      styles: global.lvyConfig.styles
    }
  },
  transferList: [port2]
})
