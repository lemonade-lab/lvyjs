import { type Plugin } from 'esbuild'
export interface ESBuildAliasOptions {
  entries?: {
    find: string | RegExp
    replacement: string
  }[]
}
import { assetsReg, cssReg } from '../../config'
import { resolve } from 'path'
/**
 * esbuild alias 插件
 * @param alias 配置对象
 * @returns 插件
 */
export const esBuildAlias = (alias?: ESBuildAliasOptions): Plugin => {
  const entries = alias?.entries
  let assets: null | RegExp = null
  if (typeof global.lvyConfig?.assets != 'boolean') {
    assets = global.lvyConfig?.assets?.filter ?? assetsReg
  }
  let styles: null | RegExp = null
  if (typeof global.lvyConfig?.styles != 'boolean') {
    styles = global.lvyConfig?.styles?.filter ?? cssReg
  }
  return {
    name: 'alias',
    setup(build) {
      if (entries) {
        build.onResolve({ filter: /.*/ }, args => {
          const url = args.path
          const resolveDir = args.resolveDir
          if (assets?.test(url) || styles?.test(url)) {
            for (const { find, replacement } of entries) {
              if (
                (find instanceof RegExp && find.test(url)) ||
                (typeof find === 'string' && url.startsWith(find))
              ) {
                let resolvedPath = url.replace(find, replacement)
                return { path: resolvedPath }
              }
            }
            return {
              path: resolve(resolveDir, url)
            }
          }
        })
      }
    }
  }
}
