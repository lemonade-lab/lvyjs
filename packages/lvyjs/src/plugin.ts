import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'
import remapping from '@jridgewell/remapping'
import type { Options } from './store'

export type Awaitable<T> = T | Promise<T>
export type PluginCommand = 'dev' | 'build'
export type PluginEnvironment = { command: PluginCommand; cwd: string }
export type ResolvedId = { id: string; external?: boolean }
export type SourceMap = {
  version: number
  sources: string[]
  names: string[]
  mappings: string
  file?: string
  sourcesContent?: (string | null)[]
  sourceRoot?: string
}
export type CodeResult = string | { code: string; map?: SourceMap | string | null }
export type PluginAsset = { name: string; source: string | Uint8Array }
export type PluginContext = {
  readonly command: PluginCommand
  readonly cwd: string
  addWatchFile(path: string): void
  /** Emit a resource and return JavaScript exporting its filesystem path. */
  emitAsset(asset: PluginAsset): Awaitable<CodeResult>
  warn(message: string): void
  error(message: string): never
}
export type DevContext = {
  readonly cwd: string
  addWatchFile(path: string): void
  restart(): void
}

/** LVY hooks run in the plugin host, never in the application's global scope. */
export interface LvyPlugin {
  name: string
  enforce?: 'pre' | 'post'
  apply?: PluginCommand
  config?(config: Options, env: PluginEnvironment): Awaitable<Partial<Options> | void>
  configResolved?(config: Readonly<Options>, env: PluginEnvironment): Awaitable<void>
  resolveId?(
    this: PluginContext,
    source: string,
    importer?: string
  ): Awaitable<string | ResolvedId | null | void>
  /** Return JavaScript for custom file types or virtual modules. */
  load?(this: PluginContext, id: string): Awaitable<CodeResult | null | void>
  /** Receives JavaScript after TS/JSX transpilation in both dev and build. */
  transform?(this: PluginContext, code: string, id: string): Awaitable<CodeResult | null | void>
  configureDev?(context: DevContext): Awaitable<void | (() => Awaitable<void>)>
  closeBundle?(): Awaitable<void>
}
export type PluginOption =
  | LvyPlugin
  | false
  | null
  | undefined
  | PluginOption[]
  | Promise<LvyPlugin | false | null | undefined | PluginOption[]>

const collectPlugins = async (options: PluginOption[]): Promise<LvyPlugin[]> => {
  const plugins: LvyPlugin[] = []
  for (const option of options) {
    const value = await option
    if (!value) continue
    if (Array.isArray(value)) plugins.push(...(await collectPlugins(value)))
    else {
      if (typeof value.name !== 'string' || !value.name.trim()) {
        throw new Error('[lvyjs] Every plugin must have a non-empty name')
      }
      plugins.push(value)
    }
  }
  return plugins
}

const mergeConfig = (config: Options, patch: Partial<Options>): Options => {
  // Plugin lists are fixed before config hooks. Arrays replace rather than merge.
  const result = { ...config }
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'plugins' || value === undefined) continue
    const previous = result[key]
    result[key] =
      value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof RegExp)
        ? mergeObject(previous, value)
        : value
  }
  return result
}
const mergeObject = (previous: any, value: any): any => {
  const result =
    previous && typeof previous === 'object' && !Array.isArray(previous) ? { ...previous } : {}
  for (const [key, next] of Object.entries(value)) {
    if (next === undefined) continue
    result[key] =
      next && typeof next === 'object' && !Array.isArray(next) && !(next instanceof RegExp)
        ? mergeObject(result[key], next)
        : next
  }
  return result
}

export const codeResult = (
  result: CodeResult
): { code: string; map?: SourceMap | string | null } =>
  typeof result === 'string' ? { code: result } : result

export class PluginContainer {
  readonly plugins: LvyPlugin[]
  private closed = false
  private cleanups: (() => Awaitable<void>)[] = []
  constructor(
    plugins: LvyPlugin[],
    readonly env: PluginEnvironment,
    private watchFile = (_path: string) => {}
  ) {
    this.plugins = plugins
  }
  context(plugin: LvyPlugin, overrides: Partial<PluginContext> = {}): PluginContext {
    return {
      ...this.env,
      addWatchFile: this.watchFile,
      emitAsset: async ({ name, source }) => {
        const hash = createHash('sha256').update(source).digest('hex').slice(0, 16)
        const path = join(this.env.cwd, '.lvy', 'assets', `${hash}-${basename(name)}`)
        await mkdir(join(this.env.cwd, '.lvy', 'assets'), { recursive: true })
        await writeFile(path, source)
        return `export default ${JSON.stringify(path)};`
      },
      warn: message => console.warn(`[lvyjs:${plugin.name}] ${message}`),
      error: message => {
        throw new Error(`[lvyjs:${plugin.name}] ${message}`)
      },
      ...overrides
    }
  }
  async invoke<T>(plugin: LvyPlugin, hook: string, callback: () => Awaitable<T>): Promise<T> {
    try {
      return await callback()
    } catch (cause) {
      throw new Error(
        `[lvyjs:${plugin.name}] ${hook}: ${cause instanceof Error ? cause.message : String(cause)}`,
        { cause }
      )
    }
  }
  async resolveId(source: string, importer?: string): Promise<ResolvedId | null> {
    for (const plugin of this.plugins) {
      if (!plugin.resolveId) continue
      const result = await this.invoke(plugin, 'resolveId', () =>
        plugin.resolveId!.call(this.context(plugin), source, importer)
      )
      if (result != null) return typeof result === 'string' ? { id: result } : result
    }
    return null
  }
  async load(id: string) {
    for (const plugin of this.plugins) {
      if (!plugin.load) continue
      const result = await this.invoke(plugin, `load (${id})`, () =>
        plugin.load!.call(this.context(plugin), id)
      )
      if (result != null) return codeResult(result)
    }
    return null
  }
  async transform(code: string, id: string, initialMap?: SourceMap | string | null) {
    let map = initialMap
    let changed = false
    for (const plugin of this.plugins) {
      if (!plugin.transform) continue
      const result = await this.invoke(plugin, `transform (${id})`, () =>
        plugin.transform!.call(this.context(plugin), code, id)
      )
      if (result != null) {
        const transformed = codeResult(result)
        code = transformed.code
        const nextMap =
          typeof transformed.map === 'string' ? JSON.parse(transformed.map) : transformed.map
        const previousMap = typeof map === 'string' ? JSON.parse(map) : map
        map =
          nextMap && previousMap
            ? (remapping([nextMap, previousMap] as any, () => null) as SourceMap)
            : nextMap
        changed = true
      }
    }
    return changed ? { code, map } : null
  }
  async configureDev(context: DevContext) {
    for (const plugin of this.plugins) {
      if (!plugin.configureDev) continue
      const cleanup = await this.invoke(plugin, 'configureDev', () => plugin.configureDev!(context))
      if (cleanup) this.cleanups.push(cleanup)
    }
  }
  async close() {
    if (this.closed) return
    this.closed = true
    const errors: unknown[] = []
    for (const cleanup of this.cleanups.splice(0).reverse()) {
      try {
        await cleanup()
      } catch (error) {
        errors.push(error)
      }
    }
    for (const plugin of this.plugins) {
      if (plugin.closeBundle) {
        try {
          await this.invoke(plugin, 'closeBundle', () => plugin.closeBundle!())
        } catch (error) {
          errors.push(error)
        }
      }
    }
    if (errors.length) throw new AggregateError(errors, '[lvyjs] Plugin cleanup failed')
  }
}

export async function createPluginContainer(
  raw: Options,
  env: PluginEnvironment,
  watchFile?: (path: string) => void,
  builtins?: (config: Options) => LvyPlugin[]
) {
  const plugins = (await collectPlugins(raw.plugins ?? []))
    .filter(plugin => !plugin.apply || plugin.apply === env.command)
    .sort(
      (a, b) =>
        (({ pre: -1, post: 1 })[a.enforce ?? ''] ?? 0) -
        ({ pre: -1, post: 1 }[b.enforce ?? ''] ?? 0)
    )
  const container = new PluginContainer(plugins, env, watchFile)
  try {
    let config = { ...raw, plugins: [...plugins] }
    for (const plugin of plugins) {
      if (!plugin.config) continue
      const patch = await container.invoke(plugin, 'config', () => plugin.config!(config, env))
      if (patch) config = mergeConfig(config, patch) as typeof config
    }
    if (builtins) {
      const pre = plugins.filter(plugin => plugin.enforce === 'pre')
      const rest = plugins.filter(plugin => plugin.enforce !== 'pre')
      plugins.splice(0, plugins.length, ...pre, ...builtins(config), ...rest)
    }
    config.plugins = [...plugins]
    for (const plugin of plugins) {
      if (plugin.configResolved)
        await container.invoke(plugin, 'configResolved', () => plugin.configResolved!(config, env))
    }
    return { config, container }
  } catch (error) {
    try {
      await container.close()
    } catch (cleanupError) {
      console.warn(cleanupError)
    }
    throw error
  }
}

export const definePlugin = (plugin: LvyPlugin): LvyPlugin => plugin
