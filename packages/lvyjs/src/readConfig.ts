import { existsSync, watch } from 'fs'
import { join } from 'path'
import process from 'process'

const main = async () => {
  const files = [
    'lvy.config.ts',
    'lvy.config.js',
    'lvy.config.mjs',
    'lvy.config.cjs',
    'lvy.config.tsx'
  ]

  let configDir = ''
  for (const file of files) {
    if (existsSync(file)) {
      configDir = file
      break
    }
  }

  if (!configDir) {
    console.warn('[lvyjs] 未找到 lvy.config 文件，使用默认配置')
    // 发送空配置，让主进程用默认值
    process.send?.({
      type: 'configReady',
      payload: { data: {} }
    })
    return
  }

  // 通知主进程配置已就绪
  const sendConfig = async () => {
    try {
      // 清除缓存
      const configPath = join(process.cwd(), configDir)

      // 动态导入配置
      const v = await import(`file://${configPath}?t=${Date.now()}`)
      const lvyConfig = v.default || v

      // 序列化配置（处理正则等特殊类型）
      const serializedConfig = JSON.parse(
        JSON.stringify(lvyConfig, (key, value) => {
          if (value instanceof RegExp) {
            return { __regexp: true, source: value.source, flags: value.flags }
          }
          return value
        })
      )

      // 发送给主进程
      process.send?.({
        type: 'configReady',
        payload: { data: serializedConfig }
      })
    } catch (err) {
      console.error('[lvyjs] 加载配置失败:', err)
      process.send?.({
        type: 'error'
      })
    }
  }

  // 首次发送
  await sendConfig()

  // 监听文件变化
  watch(process.cwd(), (_event, filename) => {
    if (files.includes(filename)) {
      console.info(`[lvyjs] 配置文件 ${filename} 已变化，重新加载...`)
      sendConfig()
    }
  })

  // 保持进程运行
  process.on('SIGINT', () => process.exit(0))
}

main()
