import { join, resolve } from 'path'
import { type Plugin } from 'esbuild'
import { existsSync } from 'fs'

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
              const resolvedPath = join(replacement, url.slice(find.length))
              const absolutePath = resolve(resolvedPath)
              const value = checkFileExtensions(absolutePath)
              if (!value) return
              return {
                path: value
              }
            } else if (find instanceof RegExp && find.test(url)) {
              // 正则匹配
              const resolvedPath = url.replace(find, replacement)
              const absolutePath = resolve(resolvedPath)
              const value = checkFileExtensions(absolutePath)
              if (!value) return
              return {
                path: value
              }
            }
          }
          return null
        })
      }
    }
  }
}

/**
 *
 * @param basePath
 * @returns
 */
const checkFileExtensions = (basePath: string) => {
  const extensions = ['.js', '.jsx', '.ts', '.tsx']
  if (existsSync(basePath)) {
    // const name = basename(basePath)
    // const rest = name.split('.')
    // // 该路径是文件命名法。
    // if (rest.length > 1) {
    //   const fileName = rest[rest.length - 1]
    //   if (fileName) return basePath
    // }
    // // 不是文件命名，路径存在，推测是路径引用
    // basePath = `${basePath}/index`
    return basePath
  }
  for (const ext of extensions) {
    const filePath = `${basePath}${ext}`
    if (existsSync(filePath)) {
      return filePath
    }
  }
  // 如果没有找到文件，返回 null
  return null
}
