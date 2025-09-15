import fs from 'fs'
import postcss from 'postcss'
import { createRequire } from 'module'
import path, { join, dirname, resolve } from 'path'

const require = createRequire(import.meta.url)

const config = {
  css: null,
  sass: null,
  less: null,
  scss: null
}

/**
 *
 * @param val
 * @returns
 */
export const createAlias = val => {
  const alias = {}
  if (!Array.isArray(val.entries)) {
    return alias
  }
  // 遍历 entries 数组
  val.entries.forEach(entry => {
    alias[entry.find] = entry.replacement
  })
  return alias
}

interface AliasConfig {
  [key: string]: string
}

export default function LessAliasPlugin(aliases: AliasConfig) {
  return {
    install: function (less: any, pluginManager: any) {
      const AliasFileManager = new less.FileManager()

      AliasFileManager.loadFile = function (
        filename: string,
        currentDirectory: string,
        options: any,
        environment: any
      ) {
        // 替换路径中的别名
        for (const alias in aliases) {
          if (filename.startsWith(alias)) {
            filename = filename.replace(alias, aliases[alias])
            break
          }
        }

        const fullPath = path.isAbsolute(filename)
          ? filename
          : path.resolve(currentDirectory, filename)

        return less.FileManager.prototype.loadFile.call(
          this,
          fullPath,
          currentDirectory,
          options,
          environment
        )
      }

      // 注册自定义文件管理器
      pluginManager.addFileManager(AliasFileManager)
    },
    minVersion: [3, 0] // 支持的最低 LESS 版本
  }
}

/**
 *
 * @param configPath
 * @param typing
 * @returns
 */
const loadPostcssConfig = (configPath: string, typing: string) => {
  if (config[typing]) {
    return {
      plugins: config[typing]
    }
  }
  const plugins: any[] = []
  let aliasEntries: any[] = []
  if (typeof global.lvyConfig?.alias != 'boolean') {
    aliasEntries = global.lvyConfig.alias?.entries || []
  }

  const includeKeys = ['postcss-import', 'postcss-url', 'autoprefixer']

  //
  if (aliasEntries.length > 0) {
    // 创建 postcss-import 插件并配置别名解析
    try {
      plugins.push(
        require('postcss-import')({
          resolve: (id, basedir) => {
            // 检查别名
            for (const entry of aliasEntries) {
              if (id.startsWith(entry.find)) {
                const aliasedPath = id.replace(entry.find, entry.replacement)
                return resolve(basedir, aliasedPath) // 返回绝对路径
              }
            }
            return id // 默认返回原始路径
          }
        })
      )
    } catch (err) {
      console.error(err)
    }
    try {
      plugins.push(
        require('postcss-url')({
          url: asset => {
            // 使用 resolve 逻辑处理 URL
            for (const entry of aliasEntries) {
              if (asset.url.startsWith(entry.find)) {
                const aliasedPath = asset.url.replace(entry.find, entry.replacement)
                return aliasedPath // 返回解析后的 URL
              }
            }
            return asset.url // 返回原始路径
          }
        })
      )
    } catch (err) {
      console.error(err)
    }
  }
  for (let i = 2; i < includeKeys.length; i++) {
    plugins.push(require(includeKeys[i])({}))
  }
  try {
    if (fs.existsSync(configPath)) {
      const cfg = require(configPath)
      // 添加其他插件
      if (!Array.isArray(cfg.plugins)) {
        const keys = Object.keys(cfg.plugins)
        for (const key of keys) {
          try {
            if (includeKeys.includes(key)) continue
            const pluginConfig = cfg.plugins[key]
            const plugin = require(key)
            if (typeof plugin === 'function') {
              plugins.push(plugin(pluginConfig))
            } else {
              throw new Error(`插件 ${key} 不是有效的 PostCSS 插件函数`)
            }
          } catch (err) {
            console.error(`加载 PostCSS 插件 ${key} 失败:`, err)
          }
        }
      } else {
        plugins.push(...cfg.plugins)
      }
    }
  } catch (err) {
    console.error('加载 PostCSS 配置失败:', err)
  }
  config[typing] = plugins
  return {
    plugins: config[typing]
  }
}

/**
 *
 * @param inputPath
 * @param outputPath
 * @returns
 */
const postCSS = (inputPath: string, outputPath: string) => {
  const configPath = join(process.cwd(), 'postcss.config.cjs')

  let typing: string = 'css'
  let parser: any = undefined

  if (/\.sass$/.test(inputPath)) {
    typing = 'sass'
  } else if (/\.less$/.test(inputPath)) {
    typing = 'less'
  } else if (/\.scss$/.test(inputPath)) {
    typing = 'scss'
  }

  const postcssConfig = loadPostcssConfig(configPath, 'css')
  if (!postcssConfig) return

  const readAndProcessCSS = async () => {
    let css = ''
    if (typing === 'less') {
      const less = require('less')
      const lessResult = await less.render(fs.readFileSync(inputPath, 'utf-8'), {
        filename: inputPath,
        plugins: [LessAliasPlugin(createAlias(global.lvyConfig?.alias))] // 使用插件
      })
      css = lessResult.css
    } else if (typing === 'sass' || typing === 'scss') {
      const sass = require('sass')
      const sassResult = sass.renderSync({ file: inputPath })
      css = sassResult.css.toString()
    } else {
      css = fs.readFileSync(inputPath, 'utf-8')
    }
    fs.mkdirSync(dirname(outputPath), { recursive: true })
    const result = await postcss(postcssConfig.plugins).process(css, {
      parser: parser,
      from: inputPath,
      to: outputPath
    })
    fs.writeFileSync(outputPath, result.css)
    if (result.warnings().length) {
      result.warnings().forEach(warn => {
        console.warn(warn.toString())
      })
    }
    const dependencies = result.messages
      .filter(msg => msg.type === 'dependency')
      .map(msg => msg.file)
    for (const dep of dependencies) {
      fs.watch(dep, eventType => {
        if (eventType === 'change') {
          readAndProcessCSS()
        }
      })
    }
  }
  readAndProcessCSS()
  fs.watch(inputPath, eventType => {
    if (eventType === 'change') {
      readAndProcessCSS()
    }
  })
}

postCSS('src/assets/test.sass', 'node_modules/lvyjs/assets/test.css')
// postCSS('src/assets/test.less', 'node_modules/lvyjs/assets/test.css')
// postCSS('src/assets/test.scss', 'node_modules/lvyjs/assets/test.css')
console.log('node_modules/lvyjs/assets/test.css')
