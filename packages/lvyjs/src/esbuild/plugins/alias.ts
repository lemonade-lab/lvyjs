import { join, resolve } from 'path'
import { type Plugin } from 'esbuild'

export interface ESBuildAliasOptions {
  entries?: {
    find: string | RegExp
    replacement: string
  }[]
}

/**
 *
 * @param alias
 * @returns
 */
export const esBuildAlias = (alias?: ESBuildAliasOptions): Plugin => {
  const entries = alias?.entries
  return {
    name: 'alias',
    setup(build) {
      // 解析路径时使用 entries
      if (entries) {
        build.onResolve({ filter: /.*/ }, args => {
          const url = args.path
          for (const { find, replacement } of entries!) {
            if (typeof find === 'string' && url.startsWith(find)) {
              // 字符串匹配
              const resolvedPath = join(replacement, url.slice(find.length))
              const absolutePath = resolve(resolvedPath)
              return {
                path: absolutePath
              }
            } else if (find instanceof RegExp && find.test(url)) {
              // 正则匹配
              const resolvedPath = url.replace(find, replacement)
              const absolutePath = resolve(resolvedPath)
              return {
                path: absolutePath
              }
            }
          }
          return null
        })
      }
    }
  }
}
