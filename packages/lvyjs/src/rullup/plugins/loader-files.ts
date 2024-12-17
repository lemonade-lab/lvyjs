import { dirname, basename, resolve } from 'path'
import { readFileSync } from 'fs'
import { type InputPluginOption } from 'rollup'
import { assetsReg } from '../../config'
export type RollupAssetsOptions = { filter?: RegExp }
/**
 * @param {Object} options
 * @returns {Object}
 */
export const rollupAssets = (options?: RollupAssetsOptions) => {
  const { filter = assetsReg } = options ?? {}
  return {
    name: 'rollup-node-files',
    resolveId(source, importer) {
      if (filter.test(source) && importer) {
        return resolve(dirname(importer), source)
      }
    },
    load(id) {
      if (filter.test(id)) {
        const referenceId = this.emitFile({
          type: 'asset',
          name: basename(id),
          source: readFileSync(id)
        })
        const contents = [
          `const reg = ['win32'].includes(process.platform) ? /^file:\\/\\/\\// : /^file:\\/\\// ;`,
          `const fileUrl = import.meta.ROLLUP_FILE_URL_${referenceId}.replace(reg, '');`,
          'export default fileUrl;'
        ].join('\n')
        return contents
      }
    }
  } as InputPluginOption
}
