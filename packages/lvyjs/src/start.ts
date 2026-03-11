import { buildAndRun } from './rullup/index.js'
import { initConfig } from './store.js'

export const main = async () => {
  if (process.argv.includes('--lvy-build')) {
    await initConfig()
    buildAndRun()
  }
}
