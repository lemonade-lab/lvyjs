import module from 'node:module'
import { startDevHost } from './dev-host'
import { assetsRegExp } from './config'
if (!module.register) {
  throw new Error(
    `This version of Node.js (${process.version}) does not support module.register(). Please upgrade to Node v18.19 or v20.6 and above.`
  )
}
const settings = process.env.__LVYJS_REGISTER_CONFIG
  ? {
      data: JSON.parse(process.env.__LVYJS_REGISTER_CONFIG),
      connection: process.env.__LVYJS_PLUGIN_CONNECTION
        ? JSON.parse(process.env.__LVYJS_PLUGIN_CONNECTION)
        : undefined
    }
  : await startDevHost()
const restoreConfig = (value: any): any => {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(restoreConfig)
  if (value.__regexp) return new RegExp(value.source, value.flags)
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      Array.isArray(item) ? item.map(restoreConfig) : restoreConfig(item)
    ])
  )
}
global.lvyConfig = restoreConfig(settings.data)
for (const [key, value] of Object.entries(global.lvyConfig.env ?? {})) {
  if (value === undefined) delete process.env[key]
  else process.env[key] = String(value)
}
const pluginConnection = settings.connection
module.register('./loader.js', {
  parentURL: import.meta.url,
  data: {
    pluginConnection,
    lvyConfig: {
      alias: global.lvyConfig?.alias,
      assets: global.lvyConfig?.assets ?? {
        filter: assetsRegExp
      }
    }
  }
})
