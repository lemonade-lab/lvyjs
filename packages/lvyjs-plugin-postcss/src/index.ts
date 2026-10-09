import { createHash } from 'node:crypto'
import postcss, { type AcceptedPlugin, type ProcessOptions } from 'postcss'
import loadConfig from 'postcss-load-config'
import postcssImport from 'postcss-import'
import postcssUrl from 'postcss-url'
import autoprefixer from 'autoprefixer'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { LvyPlugin, PluginEnvironment } from 'lvyjs'
import { SourceWatcher } from './watch'

export interface PostcssOptions {
  /** Entries handled by this plugin. Defaults to CSS/SCSS/Sass/Less. */
  include?: RegExp
  /** Config search directory relative to the project, or false to disable discovery. */
  config?: string | false
  /** Additional PostCSS plugins, after the plugins in the config file. */
  plugins?: AcceptedPlugin[]
  /** Inline CSS imports with alias support. Defaults to true. */
  imports?: boolean
  /** Rewrite URL aliases. Defaults to true. Does not copy resources. */
  urls?: boolean
  /** Add vendor prefixes. Defaults to true. */
  autoprefixer?: boolean | Parameters<typeof autoprefixer>[0]
  /** Override PostCSS process options. from/to always refer to the source entry. */
  processOptions?: Omit<ProcessOptions, 'from' | 'to'>
  /** Embed a CSS source map; overrides the config's map option when specified. */
  sourcemap?: boolean
  /** Debounce development restarts, in milliseconds. Defaults to 100. */
  watchDelay?: number
}
const ownRequire = createRequire(import.meta.url)
const prefix = '\0lvy-postcss:'
const configNames = [
  'package.json',
  '.postcssrc',
  ...['json', 'js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'yaml', 'yml'].flatMap(ext => [
    `.postcssrc.${ext}`,
    `postcss.config.${ext}`
  ])
]

export default function postcssPlugin(options: PostcssOptions = {}): LvyPlugin {
  let env: PluginEnvironment = { cwd: process.cwd(), command: 'dev' }
  let aliases: { find: string; replacement: string }[] = []
  let watcher: SourceWatcher | undefined
  let excluded: string[] = []
  let configDirectory = env.cwd
  let projectRequire = createRequire(resolve(env.cwd, 'package.json'))
  const entries = new Map<string, string>()
  const include = options.include ?? /\.(css|scss|sass|less)$/
  const knownConfigFiles = new Set<string>()
  const aliasPath = (source: string) => {
    const alias = aliases.find(
      alias => source === alias.find || source.startsWith(alias.find + '/')
    )
    return alias ? source.replace(alias.find, alias.replacement) : source
  }
  const close = async () => {
    await watcher?.close()
    entries.clear()
  }
  const preprocess = async (file: string, files: Set<string>): Promise<string> => {
    files.add(file)
    if (/\.less$/.test(file)) {
      let less: typeof import('less')
      try {
        less = projectRequire('less')
      } catch {
        throw new Error('LESS requires the optional dependency: npm install -D less')
      }
      const aliasPlugin = {
        install(engine: any, manager: any) {
          const fileManager = new engine.FileManager()
          fileManager.loadFile = function (name: string, current: string, ...args: unknown[]) {
            return engine.FileManager.prototype.loadFile.call(
              this,
              aliasPath(name),
              current,
              ...args
            )
          }
          manager.addFileManager(fileManager)
        }
      }
      const result = await less.render(await readFile(file, 'utf8'), {
        filename: file,
        plugins: [aliasPlugin]
      })
      for (const path of result.imports ?? []) files.add(resolve(path))
      return result.css
    }
    if (/\.(scss|sass)$/.test(file)) {
      let sass: typeof import('sass')
      try {
        sass = projectRequire('sass')
      } catch {
        throw new Error('Sass/SCSS requires the optional dependency: npm install -D sass')
      }
      const result = await sass.compileAsync(file, {
        importers: [
          {
            findFileUrl(source) {
              const mapped = aliasPath(source)
              return mapped === source ? null : pathToFileURL(resolve(env.cwd, mapped))
            }
          }
        ]
      })
      for (const url of result.loadedUrls)
        if (url.protocol === 'file:') files.add(fileURLToPath(url))
      return result.css
    }
    return readFile(file, 'utf8')
  }
  return {
    name: 'lvy:postcss',
    enforce: 'pre',
    configResolved(config, environment) {
      env = environment
      if (
        options.watchDelay !== undefined &&
        (!Number.isFinite(options.watchDelay) || options.watchDelay < 0)
      )
        throw new Error('watchDelay must be a nonnegative number')
      if (
        !options.include &&
        config.plugins?.some(
          plugin =>
            plugin &&
            typeof plugin === 'object' &&
            'name' in plugin &&
            plugin.name === 'lvy:tailwindcss'
        )
      )
        console.warn(
          '[lvy:postcss] PostCSS 与 Tailwind 同时启用时，请用 include 区分入口；同一入口由先匹配的插件处理。'
        )
      configDirectory = resolve(env.cwd, options.config || '.')
      projectRequire = createRequire(resolve(env.cwd, 'package.json'))
      const build = config.build && typeof config.build === 'object' ? config.build : {}
      excluded = [
        build.dir ?? build.OutputOptions?.dir ?? 'lib',
        '.lvy',
        ...(typeof build.tsdown === 'object' && typeof build.tsdown.outDir === 'string'
          ? [build.tsdown.outDir]
          : [])
      ].map(path => resolve(env.cwd, path))
      aliases = config.alias ? (config.alias.entries ?? []) : []
    },
    configureDev(context) {
      watcher = new SourceWatcher(context, excluded, options.watchDelay ?? 100, message =>
        console.warn(`[lvy:postcss] ${message}`)
      )
      return close
    },
    resolveId(source, importer) {
      if (source.startsWith(prefix)) return source
      if (source.includes('?') || source.includes('#')) return null
      include.lastIndex = 0
      if (!include.test(source)) return null
      const mapped = aliasPath(source)
      if (
        !isAbsolute(mapped) &&
        !mapped.startsWith('.') &&
        !mapped.startsWith('file:') &&
        mapped === source
      )
        return null
      const path = mapped.startsWith('file:')
        ? fileURLToPath(mapped)
        : resolve(importer && isAbsolute(importer) ? dirname(importer) : env.cwd, mapped)
      const id = prefix + createHash('sha256').update(path).digest('hex').slice(0, 24) + '.js'
      entries.set(id, path)
      return id
    },
    async load(id) {
      if (!id.startsWith(prefix)) return null
      const file = entries.get(id)
      if (!file) return null
      const files = new Set([file])
      if (options.config !== false)
        for (const name of configNames) files.add(resolve(configDirectory, name))
      // Failed config/CSS compilation must leave a watcher ready for correction.
      if (this.command === 'dev') await watcher?.watchFiles(file, files)
      // The host survives app restarts. Reload CJS config and local config helpers.
      for (const path of knownConfigFiles) delete projectRequire.cache[path]
      let configured: Awaited<ReturnType<typeof loadConfig>> | undefined
      let collectConfigFiles = () => {}
      if (options.config !== false) {
        try {
          configured = await loadConfig(
            { cwd: env.cwd, env: env.command === 'build' ? 'production' : 'development' },
            configDirectory,
            { stopDir: configDirectory }
          )
          files.add(configured.file)
          knownConfigFiles.add(configured.file)
          const visited = new Set<string>()
          const collect = (path: string) => {
            if (visited.has(path)) return
            visited.add(path)
            const mod = projectRequire.cache[path]
            for (const child of mod?.children ?? []) {
              if (child.filename.includes('/node_modules/')) continue
              knownConfigFiles.add(child.filename)
              files.add(child.filename)
              collect(child.filename)
            }
          }
          collectConfigFiles = () => collect(configured!.file)
        } catch (error) {
          if (!(error instanceof Error) || !error.message.startsWith('No PostCSS Config found'))
            throw error
        }
        // Watch missing names too: adding/deleting a config should update the pipeline.
        for (const name of configNames) files.add(resolve(configDirectory, name))
      }
      const plugins: AcceptedPlugin[] = []
      const userPlugins = [...(configured?.plugins ?? []), ...(options.plugins ?? [])]
      const configuredNames = new Set(
        userPlugins.map(plugin => (plugin as { postcssPlugin?: string }).postcssPlugin)
      )
      if (options.imports !== false && !configuredNames.has('postcss-import')) {
        const importOptions: Parameters<typeof postcssImport>[0] = {
          load: filename => preprocess(filename, files)
        }
        // Only alias matches use a custom resolver; ordinary imports keep package resolution.
        if (aliases.length)
          importOptions.resolve = (source, from, opts, node?: any) => {
            const mapped = aliasPath(source)
            if (mapped !== source) return resolve(from, mapped)
            const defaultResolve = ownRequire('postcss-import/lib/resolve-id.js')
            return defaultResolve(
              source,
              from,
              opts,
              node ?? { error: (message: string) => new Error(message) }
            )
          }
        plugins.push(postcssImport(importOptions))
      }
      if (options.urls !== false && !configuredNames.has('postcss-url'))
        plugins.push(postcssUrl({ url: asset => aliasPath(asset.url).replace(/\\/g, '/') }))
      if (options.autoprefixer !== false && !configuredNames.has('autoprefixer'))
        plugins.push(
          autoprefixer(typeof options.autoprefixer === 'object' ? options.autoprefixer : {})
        )
      plugins.push(...userPlugins)
      const input = await preprocess(file, files)
      const processOptions: ProcessOptions = {
        ...configured?.options,
        ...options.processOptions,
        from: file,
        to: file
      }
      if (options.sourcemap !== undefined)
        processOptions.map = options.sourcemap ? { inline: true } : false
      // Resources have hashed names: external map references would not be valid.
      else if (processOptions.map)
        processOptions.map = {
          ...(typeof processOptions.map === 'object' ? processOptions.map : {}),
          inline: true
        }
      const result = await postcss(plugins).process(input, processOptions)
      collectConfigFiles()
      for (const warning of result.warnings()) this.warn(warning.toString())
      const globs: { base: string; pattern: string }[] = []
      for (const message of result.messages) {
        if (message.type === 'dependency' && typeof message.file === 'string')
          files.add(resolve(message.file))
        if (message.type === 'dir-dependency' && typeof message.dir === 'string')
          globs.push({
            base: resolve(message.dir),
            pattern: typeof message.glob === 'string' ? message.glob : '**/*'
          })
      }
      if (this.command === 'build') {
        for (const path of files) this.addWatchFile(path)
        for (const glob of globs) this.addWatchFile(glob.base)
      } else await watcher?.update(file, { files, globs })
      return this.emitAsset({
        name: /\.css$/.test(file) ? basename(file) : basename(file) + '.css',
        source: result.css
      })
    },
    closeBundle: close
  }
}
export { postcssPlugin as postcss }
