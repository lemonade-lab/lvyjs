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
