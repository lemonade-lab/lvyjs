import { MessagePort } from 'worker_threads'
import { generateModuleContent, generateCSSModuleContent } from './content.js'
import { convertPath, isWin32 } from './config.js'
declare global {
  var lvyWorkerProt: MessagePort
}
// 用来消去 路径中的 file:///
const reg = isWin32() ? /^file:\/\/\// : /^file:\/\//
const baseURL = isWin32() ? 'file:///' : 'file://'
const nodeReg = /(node_modules|node_|node:)/

/**
 * 初始化时
 * @param param0
 */
export async function initialize({ port, lvyConfig }) {
  global.lvyConfig = lvyConfig
  global.lvyWorkerProt = port
}
/**
 * 启动时
 * @param specifier
 * @param context
 * @param nextResolve
 * @returns
 */
export async function resolve(specifier, context, nextResolve) {
  if (!global.lvyConfig?.alias) {
    global.lvyConfig.alias = {}
  }
  if (global.lvyConfig.alias?.entries) {
    for (const { find, replacement } of global.lvyConfig.alias?.entries) {
      if (specifier.startsWith(find)) {
        const parentURL = `${baseURL}${convertPath(specifier.replace(find, replacement))}`
        return nextResolve(specifier, {
          ...context,
          parentURL: parentURL
        })
      }
    }
  }
  return nextResolve(specifier, context)
}

/**
 * 加载脚本时
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
    // 消除 file:///
    const url = baseURL.replace(reg, '')
    const code = generateModuleContent(url)
    return nextLoad(baseURL, {
      format: 'module',
      source: code
    })
  }
  if (!global.lvyConfig.styles) {
    global.lvyConfig.styles = {}
  }
  if (global.lvyConfig.styles?.filter && global.lvyConfig.styles?.filter.test(baseURL)) {
    // 消除 file:///
    const url = baseURL.replace(reg, '')
    const code = generateCSSModuleContent(url)
    return nextLoad(baseURL, {
      format: 'module',
      source: code
    })
  }
  return nextLoad(url, context)
}
