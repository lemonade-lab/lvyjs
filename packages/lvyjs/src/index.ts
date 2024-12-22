import { buildAndRun } from './rullup/index.js'
import { initConfig, PluginsCallBack } from './store.js'

/**
 * @param input
 */
const onDev = async () => {
  const apps: (PluginsCallBack | void)[] = []
  if (Array.isArray(global.lvyConfig?.plugins)) {
    // 修改config
    for (const plugin of global.lvyConfig.plugins) {
      if (!plugin) {
        continue
      }
      await apps.push(plugin(global.lvyConfig))
    }
  }
  // 执行loader
  await import('./main.js')
  //
  for (const app of apps) {
    if (!app) {
      continue
    }
    if (typeof app == 'function') {
      await app(global.lvyConfig)
    } else if (typeof app.load == 'function') {
      app.load(global.lvyConfig)
    }
  }
}

/**
 * @param input
 */
const onBuild = async () => {
  const apps: (PluginsCallBack | void)[] = []
  if (Array.isArray(global.lvyConfig?.plugins)) {
    // 修改config
    for (const plugin of global.lvyConfig.plugins) {
      if (!plugin) {
        continue
      }
      await apps.push(plugin(global.lvyConfig))
    }
  }
  //
  for (const app of apps) {
    if (!app) {
      continue
    }
    if (typeof app != 'function' && typeof app.build == 'function') {
      await app.build(global.lvyConfig)
    }
  }
}

const main = async () => {
  if (process.argv.includes('--lvy-dev')) {
    await initConfig()
    await onDev()
  } else if (process.argv.includes('--lvy-build')) {
    await initConfig()
    await onBuild()
    buildAndRun()
  }
}

main()

export * from './store.js'
export * from './rullup/index.ts'
export * from './config.ts'
