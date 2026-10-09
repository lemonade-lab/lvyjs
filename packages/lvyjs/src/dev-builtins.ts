import { isAbsolute } from 'node:path'
import { assetsRegExp } from './config'
import type { Options } from './store'
import type { LvyPlugin } from './plugin'

/** Development equivalents of the build asset adapter. */
export function devBuiltinPlugins(config: Options): LvyPlugin[] {
  const plugins: LvyPlugin[] = []
  if (config.assets !== false) {
    const filter = config.assets?.filter ?? assetsRegExp
    plugins.push({
      name: 'lvy:assets',
      async load(id) {
        if (!isAbsolute(id)) return null
        filter.lastIndex = 0
        if (!filter.test(id)) return null
        this.addWatchFile(id)
        // Development preserves the source resource's path.
        return `export default ${JSON.stringify(id)};`
      }
    })
  }
  // Check source existence in the loaders/compiler rather than silently skipping missing files.
  return plugins
}
