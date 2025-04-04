import { join } from 'path'
import crypto from 'node:crypto'
import { convertPath } from './config'

/**
 * 生成模块内容
 * @param {string} relativePath 相对路径
 */
export const generateModuleContent = (relativePath: string) => {
  const baseURL = decodeURIComponent(relativePath)
  const contents = [
    `const reg = ['win32'].includes(process.platform) ? /^file:\\/\\/\\// : /^file:\\/\\// ;`,
    `const fileUrl = import.meta.resolve('${convertPath(baseURL)}').replace(reg, '');`,
    'export default fileUrl;'
  ].join('\n')
  return contents
}

const getRandomName = (str: string) => {
  // 使用 MD5 算法创建哈希对象
  const hash = crypto.createHash('md5')
  // 更新哈希对象内容
  hash.update(str)
  return hash.digest('hex')
}

const chache = {}

/**
 *
 * @param fileUrl
 * @returns
 */
export const generateCSSModuleContent = (relativePath: string) => {
  const inputURL = decodeURIComponent(relativePath)
  const fileName = getRandomName(inputURL)
  const outputURL = convertPath(
    join(process.cwd(), 'node_modules', 'lvyjs', 'assets', `${fileName}.css`)
  )
  if (!chache[inputURL]) {
    global.lvyWorkerProt.postMessage({
      type: 'CSS_MODULE_GENERATED',
      payload: {
        from: inputURL,
        to: outputURL
      }
    })
    chache[inputURL] = true
  }
  return `export default "${outputURL}";`
}
