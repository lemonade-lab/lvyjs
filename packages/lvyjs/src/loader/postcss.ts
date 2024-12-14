import fs from 'fs'
import postcss from 'postcss'
import { createRequire } from 'module'
import { join, dirname } from 'path'

const require = createRequire(import.meta.url)

const loadPostcssConfig = (configPath: string) => {
  try {
    if (fs.existsSync(configPath)) {
      const cfg = require(configPath)

      if (!Array.isArray(cfg.plugins)) {
        const keys = Object.keys(cfg.plugins)
        const plugins = keys
          .map(key => {
            try {
              const pluginConfig = cfg.plugins[key]
              const plugin = require(key)
              if (typeof plugin === 'function') {
                return plugin(pluginConfig)
              } else {
                throw new Error(`插件 ${key} 不是有效的 PostCSS 插件函数`)
              }
            } catch (err) {
              console.error(`加载 PostCSS 插件 ${key} 失败:`, err)
              return null
            }
          })
          .filter(Boolean)
        return { plugins }
      }
      return cfg
    } else {
      throw new Error(`未找到 PostCSS 配置文件: ${configPath}`)
    }
  } catch (err) {
    console.error('加载 PostCSS 配置失败:', err)
    return { plugins: [] }
  }
}

const postCSS = (inputPath: string, outputPath: string) => {
  const configPath = join(process.cwd(), 'postcss.config.cjs')
  const postcssConfig = loadPostcssConfig(configPath)

  const readAndProcessCSS = async () => {
    const css = fs.readFileSync(inputPath, 'utf-8')
    fs.mkdirSync(dirname(outputPath), { recursive: true })
    const result = await postcss(postcssConfig.plugins).process(css, {
      from: inputPath,
      to: outputPath
    })
    fs.writeFileSync(outputPath, result.css)
    console.log(`输出文件已写入: ${outputPath}`)

    if (result.warnings().length) {
      result.warnings().forEach(warn => {
        console.warn(warn.toString())
      })
    }

    const dependencies = result.messages
      .filter(msg => msg.type === 'dependency')
      .map(msg => msg.file)

    for (const dep of dependencies) {
      console.log(`开始监听依赖文件: ${dep}`)
      fs.watch(dep, eventType => {
        if (eventType === 'change') {
          console.log(`依赖文件 ${dep} 已更改，重新处理...`)
          readAndProcessCSS()
        }
      })
    }
  }

  readAndProcessCSS()

  console.log(`开始监听输入文件: ${inputPath}`)

  fs.watch(inputPath, eventType => {
    if (eventType === 'change') {
      console.log(`输入文件 ${inputPath} 已更改，重新处理...`)
      readAndProcessCSS()
    }
  })
}

export { postCSS }
