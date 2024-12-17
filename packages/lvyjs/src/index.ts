import { buildAndRun } from './rullup/index.js'
import { initConfig } from './store.js'

/**
 * @param input
 */
const onDev = async () => {
  const apps: any = []
  if (Array.isArray(global.lvyConfig?.plugins)) {
    // 修改config
    for (const plugin of global.lvyConfig.plugins) {
      if (!plugin) {
        continue
      }
      apps.push(plugin(global.lvyConfig))
    }
  }
  // 执行loader
  await import('./main.js')
  //
  for (const app of apps) {
    if (!app) {
      continue
    }
    if (typeof app == 'function') app(global.lvyConfig)
  }
}

const main = async () => {
  if (process.argv.includes('--lvy-dev')) {
    await initConfig()
    onDev()
  } else if (process.argv.includes('--lvy-build')) {
    await initConfig()
    buildAndRun()
  }
}

main()

export * from './store.js'
export * from './rullup/index.ts'
export * from './config.ts'
