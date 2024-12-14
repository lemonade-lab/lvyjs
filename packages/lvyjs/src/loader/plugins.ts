import { join, resolve } from 'path'
import { type Plugin } from 'esbuild'
import crypto from 'node:crypto'
import { Alias } from '@rollup/plugin-alias'
import { assetsReg, cssReg } from './config'
import { postCSS } from './postcss'

/**
 *
 * @param alias
 * @returns
 */
export const esBuildAlias = (alias?: { entries?: Alias[] }): Plugin => {
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

/**
 *
 * @param inputPath
 * @returns
 */
const convertPath = (inputPath: string) => {
  return process.platform === 'win32' ? inputPath.replace(/\\/g, '/') : inputPath
}

/**
 * 生成模块内容
 * @param {string} relativePath 相对路径
 */
const generateModuleContent = (relativePath: string) => {
  const contents = [
    'const createUrl = (basePath, path) => {',
    "const platform = ['linux', 'android', 'darwin'];",
    'const T = platform.includes(process.platform);',
    'const reg = T ? /^file:\\/\\// : /^file:\\/\\/\\//;',
    "return new URL(path, basePath).href.replace(reg, '');",
    '};',
    `const fileUrl = createUrl(import.meta.url, '${convertPath(relativePath)}');`,
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
const generateCSSModuleContent = (pathURL: string) => {
  const fileName = getRandomName(pathURL)
  const outputFileURL = convertPath(
    join(process.cwd(), 'node_modules', 'lvyjs', 'assets', `${fileName}.css`)
  )
  if (!chache[pathURL]) {
    console.log('postCSS')
    postCSS(convertPath(pathURL), outputFileURL)
    chache[pathURL] = true
  }
  return `export default "${outputFileURL}";`
}

export type ESBuildAsstesOptions = {
  filter?: RegExp
}

/**
 *
 * @param param0
 */
export const esBuildAsstes = (optoins?: ESBuildAsstesOptions): Plugin => {
  // 默认配置
  const filter = optoins?.filter ?? assetsReg
  // 返回插件
  return {
    name: 'assets',
    setup(build) {
      build.onLoad({ filter }, args => {
        const content = generateModuleContent(args.path)
        return {
          contents: content,
          loader: 'js'
        }
      })
    }
  }
}

export type ESBuildCSSOptions = {
  filter?: RegExp
  configPath?: string
}

/**
 * css资源处理插件
 * @param param0
 * @returns
 */
export const esBuildCSS = (optoins?: ESBuildCSSOptions): Plugin => {
  const filter = optoins?.filter || cssReg
  // 返回插件
  return {
    name: 'css-loader',
    setup(build) {
      // 加载 CSS/SCSS 文件
      build.onLoad({ filter }, args => {
        const contents = generateCSSModuleContent(args.path)
        return {
          contents: contents,
          loader: 'js'
        }
      })
    }
  }
}
