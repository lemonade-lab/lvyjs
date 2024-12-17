import { MessagePort } from 'worker_threads'
import { generateCSSModuleContent, generateModuleContent } from './content'
declare global {
  var lvyWorkerProt: MessagePort
}
const platform = ['win32'].includes(process.platform)
const reg = platform ? /^file:\/\/\// : /^file:\/\//
const nodeReg = /(node_modules|node_|node:)/
/**
 *
 * @param param0
 */
export async function initialize({ port, lvyConfig }) {
  global.lvyConfig = lvyConfig
  global.lvyWorkerProt = port
}

/**
 * @param specifier
 * @param context
 * @param nextResolve
 * @returns
 */
export async function resolve(specifier, context, nextResolve) {
  const { parentURL = null } = context
  if (!global.lvyConfig?.alias) {
    global.lvyConfig.alias = {}
  }
  if (global.lvyConfig.alias?.entries) {
    for (const { find, replacement } of global.lvyConfig.alias?.entries) {
      if (specifier.startsWith(find)) {
        const url = specifier.replace(find, replacement)
        return nextResolve(specifier, {
          ...context,
          parentURL: parentURL ? new URL(url, parentURL).href : new URL(url).href
        })
      }
    }
  }
  return nextResolve(specifier, context)
}

/**
 * @param url
 * @param context
 * @param defaultLoad
 * @returns
 */
export const load = (url, context, nextLoad) => {
  if (nodeReg.test(url)) {
    return nextLoad(url, context)
  }
  const urls = url.split('?')
  const baseURL = urls[0]
  // 得到静态资源。转为普通的文件引用。
  if (!global.lvyConfig.assets) {
    global.lvyConfig.assets = {}
  }
  // 匹配静态资源
  if (global.lvyConfig.assets?.filter && global.lvyConfig.assets?.filter.test(baseURL)) {
    const code = generateModuleContent(baseURL.replace(reg, ''))
    return nextLoad(baseURL, {
      format: 'module',
      source: code
    })
  }
  if (!global.lvyConfig.styles) {
    global.lvyConfig.styles = {}
  }
  if (global.lvyConfig.styles?.filter && global.lvyConfig.styles?.filter.test(baseURL)) {
    const code = generateCSSModuleContent(baseURL.replace(reg, ''))
    return nextLoad(baseURL, {
      format: 'module',
      source: code
    })
  }
  return nextLoad(url, context)
}
