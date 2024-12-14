import { basename, join, resolve } from 'path'
import { spawn } from 'child_process'
import { type Plugin } from 'esbuild'
// import crypto from 'node:crypto'
import tmp from 'tmp'
import { Alias } from '@rollup/plugin-alias'
import { assetsReg, cssReg } from './config'

/**
 *
 * @param input
 * @param output
 */
const startCssPost = (input: string, output: string) => {
  const run = ['postcss', input, '-o', output, '--watch']
  // 启动 Tailwind 进程
  const cssPostProcess = spawn('npx', run, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  cssPostProcess.on('error', err => {
    console.error('Failed to start Tailwind process:', err)
  })
  process.on('exit', () => {
    cssPostProcess.kill()
  })
}

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

const chache = {}

/**
 *
 * @param fileUrl
 * @returns
 */
const handleCSS = (fileUrl: string) => {
  const tmpDirPath = tmp.dirSync({ unsafeCleanup: true }).name
  const outputDir = resolve(tmpDirPath, basename(fileUrl))
  if (!chache[fileUrl]) {
    startCssPost(fileUrl, outputDir)
    chache[fileUrl] = true
  }
  return outputDir
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
      build.onLoad({ filter }, async args => {
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
      build.onLoad({ filter }, async args => {
        // 不是别名资源
        const cssPath = convertPath(handleCSS(args.path))
        const contents = `export default "${cssPath}";`
        return {
          contents: contents,
          loader: 'js'
        }
      })
    }
  }
}
