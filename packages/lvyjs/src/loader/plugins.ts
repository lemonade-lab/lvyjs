import { dirname, join, relative, resolve } from 'path'
import { spawn } from 'child_process'
import { type Plugin } from 'esbuild'
import crypto from 'node:crypto'
import { RollupAliasOptions } from '@rollup/plugin-alias'

const assetsReg = /\.(png|jpg|jpeg|gif|svg|webp|ico)$/
const cssReg = /\.(css|scss)$/

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

const getHash = (str: string) => {
  // 使用 MD5 算法创建哈希对象
  const hash = crypto.createHash('md5')
  // 更新哈希对象内容
  hash.update(str)
  return hash.digest('hex')
}

let entries = null

export const esBuildAlias = (alias?: { entries?: RollupAliasOptions['entries'] }) => {
  if (!entries) {
    entries = alias?.entries ?? []
  }
}

const handleAsstesFile = (url: string) => {
  for (const { find, replacement } of entries) {
    if (typeof find === 'string') {
      // 使用 startsWith 处理字符串类型
      if (url.startsWith(find)) {
        const fileUrl = join(replacement, url.replace(find, ''))
        return `export default "${convertPath(fileUrl)}";`
      }
    } else if (find instanceof RegExp) {
      // 使用 test 方法处理正则表达式类型
      if (find.test(url)) {
        const fileUrl = join(replacement, url.replace(find, ''))
        return `export default "${convertPath(fileUrl)}";`
      }
    }
  }
  return null
}

/**
 *
 * @param fileUrl
 * @returns
 */
const handleCSS = (fileUrl: string) => {
  const hash = getHash(fileUrl)
  const outputDir = join(process.cwd(), 'node_modules', 'lvyjs', 'assets', `${hash}.css`)
  if (!chache[fileUrl]) {
    startCssPost(fileUrl, outputDir)
    chache[fileUrl] = true
  }
  return outputDir
}

/**
 * 处理路径别名的加载
 * @param {string} url URL
 * @returns {string|null} 加载结果
 */
const handleCSSPath = (url: string) => {
  for (const { find, replacement } of entries) {
    if (typeof find === 'string') {
      // 使用 startsWith 处理字符串类型
      if (url.startsWith(find)) {
        const fileUrl = join(replacement, url.replace(find, ''))
        const outputDir = handleCSS(fileUrl)
        return `export default "${convertPath(outputDir)}";`
      }
    } else if (find instanceof RegExp) {
      // 使用 test 方法处理正则表达式类型
      if (find.test(url)) {
        const fileUrl = join(replacement, url.replace(find, ''))
        const outputDir = handleCSS(fileUrl)
        return `export default "${convertPath(outputDir)}";`
      }
    }
  }
  return null
}

export type ESBuildAsstesOptions = {
  filter?: RegExp
}

/**
 *
 * @param param0
 */
export const esBuildAsstes = (optoins: ESBuildAsstesOptions = {}): Plugin => {
  // 默认配置
  const filter = optoins?.filter ?? assetsReg
  const namespace = 'assets'
  // 返回插件
  return {
    name: 'assets-loader',
    setup(build) {
      const outputDirs = new Map()
      // 过滤图片文件
      build.onResolve({ filter }, args => {
        const dir = resolve(args.resolveDir, args.path)
        outputDirs.set(dir, args.importer)
        return {
          path: dir,
          namespace
        }
      })
      build.onLoad({ filter, namespace }, async args => {
        if (!outputDirs.has(args.path)) return null
        const outputDir = outputDirs.get(args.path)
        const relativePath = relative(dirname(outputDir), args.path)
        // 不管是别名资源。都只是需要返回一个路径
        const aliasResult = handleAsstesFile(relativePath)
        if (aliasResult) {
          return {
            contents: aliasResult,
            loader: 'js'
          }
        }
        return {
          contents: generateModuleContent(relativePath),
          loader: 'js'
        }
      })
    }
  }
}

export type ESBuildCSSOptions = {
  filter?: RegExp
  namespace?: string
}

/**
 * css资源处理插件
 * @param param0
 * @returns
 */
export const esBuildCSS = (optoins: ESBuildCSSOptions = {}): Plugin => {
  const filter = optoins?.filter || cssReg
  const namespace = optoins?.namespace || 'css'
  // 返回插件
  return {
    name: 'css-loader',
    setup(build) {
      const outputDirs = new Map()
      // 过滤 CSS/SCSS 文件
      build.onResolve({ filter }, args => {
        const dir = resolve(args.resolveDir, args.path)
        outputDirs.set(dir, args.importer)
        return {
          path: dir,
          namespace
        }
      })
      // 加载 CSS/SCSS 文件
      build.onLoad({ filter, namespace }, async args => {
        if (!outputDirs.has(args.path)) return null
        const outputDir = outputDirs.get(args.path)
        // 计算相对路径
        const relativePath = relative(dirname(outputDir), args.path)
        // 处理路径别名的加载
        const aliasResult = handleCSSPath(relativePath)
        if (aliasResult) {
          return {
            contents: aliasResult,
            loader: 'js'
          }
        }
        // 不是别名资源
        return {
          contents: `export default "${convertPath(handleCSS(args.path))}";`,
          loader: 'js'
        }
      })
    }
  }
}
