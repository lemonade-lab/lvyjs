import { fileURLToPath, pathToFileURL } from 'node:url'
import { isAbsolute, resolve as resolvePath, dirname, join } from 'node:path'
import { isBuiltin } from 'node:module'
import { generateModuleContent } from './content.js'
import { initializePluginRpc, pluginRequest } from './plugin-rpc'
let pluginHost = false
const virtualPrefix = 'lvy:virtual/'
const virtualIds = new Map<string, string>()
const moduleIds = new Map<string, string>()

export async function initialize({ lvyConfig, pluginConnection }) {
  global.lvyConfig = lvyConfig
  pluginHost = !!pluginConnection
  if (pluginConnection) await initializePluginRpc(pluginConnection)
}
const moduleId = (url: string) =>
  moduleIds.get(url) ?? (url.startsWith('file:') ? fileURLToPath(new URL(url)) : url)
const isDependency = (url: string) => url.includes('/node_modules/')

export async function resolve(specifier, context, nextResolve) {
  const fallbackContext = context.parentURL?.startsWith(virtualPrefix)
    ? { ...context, parentURL: pathToFileURL(join(process.cwd(), '__lvy_virtual__.js')).href }
    : context
  if (pluginHost && !isBuiltin(specifier) && !isDependency(context.parentURL ?? '')) {
    const result = await pluginRequest(
      'resolveId',
      specifier,
      context.parentURL ? moduleId(context.parentURL) : undefined
    )
    if (result) {
      if (result.external) return nextResolve(result.id, fallbackContext)
      const id = result.id
      if (id.startsWith('file:')) {
        const resolved = await nextResolve(id, fallbackContext)
        moduleIds.set(resolved.url, fileURLToPath(id))
        return resolved
      }
      if (isAbsolute(id) || id.startsWith('.')) {
        const path = isAbsolute(id)
          ? id
          : resolvePath(
              context.parentURL?.startsWith('file:')
                ? dirname(fileURLToPath(context.parentURL))
                : process.cwd(),
              id
            )
        const resolved = await nextResolve(pathToFileURL(path).href, fallbackContext)
        moduleIds.set(resolved.url, path)
        return resolved
      }
      const url = virtualPrefix + Buffer.from(id).toString('base64url')
      virtualIds.set(url, id)
      return { url, shortCircuit: true }
    }
  }
  const alias = global.lvyConfig?.alias
  if (alias && Array.isArray(alias.entries)) {
    for (const { find, replacement } of alias.entries) {
      if (specifier.startsWith(find))
        return nextResolve(
          pathToFileURL(specifier.replace(find, replacement)).href,
          fallbackContext
        )
    }
  }
  return nextResolve(specifier, fallbackContext)
}

export async function load(url, context, nextLoad) {
  if (isBuiltin(url) || isDependency(url)) return nextLoad(url, context)
  const id = virtualIds.get(url) ?? moduleId(url)
  let loaded: any = null
  if (pluginHost) loaded = await pluginRequest('load', id)
  if (!loaded && url.startsWith(virtualPrefix))
    throw new Error(`[lvyjs] No plugin loaded virtual module: ${id}`)
  let result: any
  if (loaded) result = { format: 'module', source: loaded.code, shortCircuit: true }
  else if (
    url.startsWith('file:') &&
    global.lvyConfig.assets &&
    global.lvyConfig.assets.filter?.test(id)
  ) {
    result = { format: 'module', source: generateModuleContent(id), shortCircuit: true }
  } else result = await nextLoad(url, context)
  if (loaded?.map) {
    const map = typeof loaded.map === 'string' ? loaded.map : JSON.stringify(loaded.map)
    result.source +=
      '\n//# sourceMappingURL=data:application/json;base64,' + Buffer.from(map).toString('base64')
  }
  // JSON and CommonJS retain Node/tsx semantics; plugins return ESM JavaScript.
  if (pluginHost && result.format === 'module' && result.source != null) {
    const source =
      typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString()
    const transformed = await pluginRequest('transform', source, id)
    if (transformed) {
      let code = transformed.code.replace(/\n?\/\/[#@] sourceMappingURL=data:[^\n]*\n?$/g, '')
      if (transformed.map) {
        const map =
          typeof transformed.map === 'string' ? transformed.map : JSON.stringify(transformed.map)
        code +=
          '\n//# sourceMappingURL=data:application/json;base64,' +
          Buffer.from(map).toString('base64')
      }
      result = { ...result, source: code }
    }
  }
  return result
}
