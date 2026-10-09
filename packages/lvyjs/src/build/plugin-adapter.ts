import { transpileJavascript } from '../javascript'
import type { TsdownPlugin } from 'tsdown'
import type { PluginContext } from '../plugin'
import { codeResult, type LvyPlugin, type PluginContainer } from '../plugin'

/** Transpile before LVY transforms so both environments expose JavaScript. */
export function javascriptPlugin(container: PluginContainer): TsdownPlugin[] {
  if (!container.plugins.some(plugin => plugin.transform)) return []
  return [
    {
      name: 'lvy-plugin-javascript',
      async transform(code, id) {
        if (!/\.(?:[cm]?ts|tsx|jsx)$/.test(id)) return null
        return transpileJavascript(code, id, container.env.cwd)
      }
    }
  ]
}

export function buildPluginAdapter(container: PluginContainer, plugin: LvyPlugin): TsdownPlugin {
  const context = (native: any): Partial<PluginContext> => ({
    addWatchFile: path => native.addWatchFile(path),
    emitAsset: ({ name, source }) => {
      const reference = native.emitFile({ type: 'asset', name, source })
      return `import { fileURLToPath } from 'node:url'; export default fileURLToPath(import.meta.ROLLUP_FILE_URL_${reference});`
    }
  })
  return {
    name: plugin.name,
    resolveId: plugin.resolveId
      ? async function (source, importer) {
          return container.invoke(plugin, 'resolveId', () =>
            plugin.resolveId!.call(container.context(plugin, context(this)), source, importer)
          )
        }
      : undefined,
    load: plugin.load
      ? async function (id) {
          const result = await container.invoke(plugin, `load (${id})`, () =>
            plugin.load!.call(container.context(plugin, context(this)), id)
          )
          return result == null ? null : codeResult(result)
        }
      : undefined,
    transform: plugin.transform
      ? async function (code, id) {
          const result = await container.invoke(plugin, `transform (${id})`, () =>
            plugin.transform!.call(container.context(plugin, context(this)), code, id)
          )
          return result == null ? null : codeResult(result)
        }
      : undefined
  }
}
