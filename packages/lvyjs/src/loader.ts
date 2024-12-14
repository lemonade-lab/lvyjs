import { ESBuild } from './esbuild/index.js'
import { MessagePort } from 'worker_threads'
declare global {
  var lvyWorkerProt: MessagePort
}
const platform = ['win32'].includes(process.platform)
const reg = platform ? /^file:\/\/\// : /^file:\/\//
const nodeReg = /(node_modules|node_|node:)/
const jsReg = /\.(js|ts|jsx|tsx)$/
export async function initialize({ port, lvyConfig }) {
  global.lvyConfig = lvyConfig
  global.lvyWorkerProt = port
}
/**
 * @param url
 * @param context
 * @param defaultLoad
 * @returns
 */
const load = async (url, context, defaultLoad) => {
  if (nodeReg.test(url)) {
    return defaultLoad(url, context)
  }
  if (!jsReg.test(url)) {
    return defaultLoad(url, context)
  }
  const code = await ESBuild(url.replace(reg, ''))
  return defaultLoad(url, {
    format: 'module',
    source: code
  })
}
export { load }
