import fs from 'fs'
import postcss from 'postcss'
import { createRequire } from 'module'
import { dirname, join, resolve, basename } from 'path'
import chokidar from 'chokidar'

const require = createRequire(import.meta.url)

// 加载 postcss 配置文件
const loadPostcssConfig = configPath => {
  try {
    if (fs.existsSync(configPath)) {
      const cfg = require(configPath)
      if (!Array.isArray(cfg.plugins)) {
        const keys = Object.keys(cfg.plugins)
        const plugins = keys
          .map(key => {
            try {
              const pluginConfig = cfg.plugins[key]
              const plugin = require(key) // 动态加载插件
              if (typeof plugin === 'function') {
                return plugin(pluginConfig)
              } else {
                throw new Error(`Plugin ${key} is not a valid PostCSS plugin function.`)
              }
            } catch (err) {
              console.error(`Failed to load PostCSS plugin ${key}:`, err)
              return null // 返回 null 以便过滤无效插件
            }
          })
          .filter(Boolean) // 过滤掉无效插件

        return { plugins }
      }
      return cfg // 如果 plugins 是数组，则直接返回
    } else {
      throw new Error(`PostCSS config file not found at ${configPath}`)
    }
  } catch (err) {
    console.error('Failed to load PostCSS config:', err)
    return { plugins: [] } // 默认插件
  }
}

const postCSS = (inputPath, outputPath) => {
  const configPath = join(process.cwd(), 'postcss.config.cjs')

  // 加载 PostCSS 配置
  const postcssConfig = loadPostcssConfig(configPath)

  // 定义处理 CSS 的函数
  const processCSS = async css => {
    try {
      const result = await postcss(postcssConfig.plugins) // 使用配置中的插件
        .process(css, { from: inputPath, to: outputPath })

      // 写入输出 CSS 文件
      fs.writeFileSync(outputPath, result.css)
      console.log(`Output written to ${outputPath}`)

      // 如果有 warnings，输出警告信息
      if (result.warnings().length) {
        result.warnings().forEach(warn => {
          console.warn(warn.toString())
        })
      }

      // 返回依赖文件
      return result.messages.filter(msg => msg.type === 'dependency').map(msg => msg.file)
    } catch (error) {
      console.error(`PostCSS process error: ${error}`)
      return []
    }
  }

  // 读取输入 CSS 文件并处理
  const readAndProcessCSS = async () => {
    try {
      const css = await fs.promises.readFile(inputPath)
      fs.mkdirSync(dirname(outputPath), { recursive: true })
      const dependencies = await processCSS(css)

      // 监控依赖文件变化
      dependencies.forEach(dep => {
        chokidar.watch(dep).on('change', path => {
          console.log(`Dependency file ${path} has been changed. Reprocessing...`)
          readAndProcessCSS()
        })
      })
    } catch (err) {
      console.error(`Error reading input file: ${err}`)
    }
  }

  // 初始处理
  readAndProcessCSS()

  // 监控输入文件变化
  chokidar.watch(inputPath).on('change', path => {
    console.log(`File ${path} has been changed. Reprocessing...`)
    readAndProcessCSS()
  })
}

// 输入和输出路径
const inputPath = `C:\\Users\\PYY\\Desktop\\core\\src\\assets\\test.css`
const outputPath = `C:\\Users\\PYY\\Desktop\\core\\node_modules\\lvyjs\\assets\\b796f92dea6451b197a964e7abcacc23.css`

postCSS(inputPath, outputPath)
