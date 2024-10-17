import { buildAndRun } from './build/rullup.js'
import { initConfig } from './store.js'

/**
 * @param input
 */
const onDev = async () => {
  // 修改config
  for (const plugin of global.lvyConfig.plugins) {
    if (plugin?.config) {
      const cfg = await plugin.config(global.lvyConfig)
      for (const key in cfg) {
        // 不能覆盖plugins
        if (cfg[key] != 'plugins') {
          // 覆盖
          global.lvyConfig[key] = cfg[key]
        }
      }
    }
  }
  // 执行loader
  await import('./loader/main.js')
  // 执行 useApp
  for (const plugin of global.lvyConfig.plugins) {
    if (plugin?.useApp) await plugin.useApp()
  }
}

/**
 *
 * @param input
 * @param ouput
 */
const onBuild = () => {
  buildAndRun('src', 'lib')
}

const main = async () => {
  if (process.argv.includes('--lvy-dev')) {
    await initConfig()
    onDev()
  } else if (process.argv.includes('--lvy-build')) {
    await initConfig()
    onBuild()
  }
}

main()

export { defineConfig, initConfig } from './store.js'
