import fs from 'fs'
import postcss from 'postcss'
import { createRequire } from 'module'
import { join, dirname, resolve } from 'path'
const require = createRequire(import.meta.url)
const loadPostcssConfig = configPath => {
  const plugins: any[] = []
  let aliasEntries: any[] = []
  if (typeof global.lvyConfig?.alias != 'boolean') {
    aliasEntries = global.lvyConfig.alias?.entries || []
  }
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
  }
  try {
    if (fs.existsSync(configPath)) {
      const cfg = require(configPath)
      // 添加其他插件
      if (!Array.isArray(cfg.plugins)) {
        const keys = Object.keys(cfg.plugins)
        keys.forEach(key => {
          try {
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
        })
      } else {
        plugins.push(...cfg.plugins)
      }
      return { plugins }
    } else {
      throw new Error(`未找到 PostCSS 配置文件: ${configPath}`)
    }
  } catch (err) {
    console.error('加载 PostCSS 配置失败:', err)
    return { plugins }
  }
}

const postCSS = (inputPath, outputPath) => {
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

export { postCSS }
