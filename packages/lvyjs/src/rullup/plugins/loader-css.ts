import { createFilter } from '@rollup/pluginutils'
import { basename, dirname, resolve } from 'node:path'
import { type InputPluginOption } from 'rollup'
import { stylesRegExp } from '../../config'
import { createFuncCode } from './funcCode'

export type RollupStylesCSSImportOptions = { filter?: RegExp }

/**
 *
 * @returns
 */
export const rollupStylesCSSImport = (options?: RollupStylesCSSImportOptions) => {
  const include = options?.filter ?? stylesRegExp
  const filter = createFilter(include, null)
  return {
    name: 'c-css',
    resolveId(source, importer) {
      if (filter(source) && importer) {
        return resolve(dirname(importer), source)
      }
    },
    load(id) {
      if (filter(id)) this.addWatchFile(resolve(id))
      return null
    },
    async transform(code, id) {
      if (!filter(id)) return null
      // 删除 export default css
      const curCode = code.replace(/(export|default css)/g, '')
      // 使用 eval 执行代码并获取默认导出的值
      const funcCode = createFuncCode(curCode)
      // 得到css变量的值
      const csscode = eval(funcCode)
      // 确保最后生产的css文件
      const refeId = this.emitFile({
        // 属于静态资源
        type: 'asset',
        name: basename(`${id}.css`),
        // 内容
        source: csscode
      })
      const contents = [
        `const reg = ['win32'].includes(process.platform) ? /^file:\\/\\/\\// : /^file:\\/\\// ;`,
        `const fileUrl = import.meta.ROLLUP_FILE_URL_${refeId}.replace(reg, '');`,
        'export default fileUrl;'
      ].join('\n')
      return contents
    }
  } as InputPluginOption
}
