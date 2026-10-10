import { createHash } from 'node:crypto'
import { compile, Features, optimize, toSourceMap } from '@tailwindcss/node'
import { clearRequireCache } from '@tailwindcss/node/require-cache'
import { Scanner, type SourceEntry } from '@tailwindcss/oxide'
import { readFile, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { LvyPlugin, Options, PluginEnvironment } from 'lvyjs'
import { SourceWatcher, within } from './watch'
import { assetName, rewriteUrls } from './urls'

export interface TailwindcssOptions {
  /** Directory for automatic class detection. Defaults to the LVY project root. */
  base?: string
  /** CSS entries handled by this plugin. Defaults to /\.css$/. */
  include?: RegExp
  /** Optimize CSS. Defaults to true for builds and false during development. */
  optimize?: boolean | { minify?: boolean }
  /** Embed a CSS source map. Defaults to false. */
  sourcemap?: boolean
  /** Additional directories excluded from scanning and watching, relative to the project. */
  exclude?: string[]
  /** Debounce before requesting an application restart. Defaults to 100ms. */
  watchDelay?: number
}
const prefix = '\0lvy-tailwindcss:'
const posix = (path: string) => path.split(sep).join('/')

export default function tailwindcss(options: TailwindcssOptions = {}): LvyPlugin {
  let env: PluginEnvironment = { cwd: process.cwd(), command: 'dev' }
  let base = env.cwd
  let aliases: { find: string; replacement: string }[] = []
  let excluded: string[] = []
  let watcher: SourceWatcher | undefined
  const dependenciesByEntry = new Map<string, Set<string>>()
  const entries = new Map<string, string>()
  const include = options.include ?? /\.css$/
  const applyAlias = (source: string) => {
    const alias = aliases.find(
      alias => source === alias.find || source.startsWith(alias.find + '/')
    )
    return alias ? source.replace(alias.find, alias.replacement) : source
  }
  const resolver = async (source: string, from: string) => {
    const mapped = applyAlias(source)
    return mapped === source ? undefined : resolve(from, mapped)
  }
  const close = async () => {
    await watcher?.close()
    entries.clear()
    dependenciesByEntry.clear()
  }

  return {
    name: 'lvy:tailwindcss',
    enforce: 'pre',
    configResolved(config: Readonly<Options>, environment) {
      env = environment
      if (
        options.watchDelay !== undefined &&
        (!Number.isFinite(options.watchDelay) || options.watchDelay < 0)
      )
        throw new Error('watchDelay must be a nonnegative number')
      base = resolve(env.cwd, options.base ?? '.')
      aliases = config.alias ? (config.alias.entries ?? []) : []
      const build = config.build && typeof config.build === 'object' ? config.build : {}
      const nativeOutput =
        build.tsdown && typeof build.tsdown === 'object' ? build.tsdown.outDir : undefined
      const outputs = [
        build.dir ?? build.OutputOptions?.dir ?? 'lib',
        ...(typeof nativeOutput === 'string' ? [nativeOutput] : [])
      ]
      excluded = [...outputs, '.lvy', ...(options.exclude ?? [])].map(path =>
        resolve(env.cwd, path)
      )
      // Excluding the source root would silently generate incomplete CSS.
      if (excluded.some(directory => within(base, directory))) {
        throw new Error('Tailwind source base must not be inside an excluded/output directory')
      }
    },
    configureDev(context) {
      watcher = new SourceWatcher(context, excluded, options.watchDelay ?? 100, message =>
        console.warn(`[lvy:tailwindcss] ${message}`)
      )
      return close
    },
    resolveId(source, importer) {
      if (source.startsWith(prefix)) return source
      // Query variants such as ?raw/?url are intentionally left to other plugins.
      if (source.includes('?') || source.includes('#')) return null
      include.lastIndex = 0
      if (!include.test(source)) return null
      const mapped = applyAlias(source)
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
      // The emitted module is JavaScript; avoid tsdown's raw CSS transform guard.
      const id = prefix + createHash('sha256').update(path).digest('hex').slice(0, 24) + '.js'
      entries.set(id, path)
      return id
    },
    async load(id) {
      if (!id.startsWith(prefix)) return null
      const entry = entries.get(id)
      if (!entry) return null
      // Watch before compiling so fixing an initial syntax error can revive the app.
      if (this.command === 'dev') await watcher?.watchFiles(entry, [entry])
      const input = await readFile(entry, 'utf8')
      // Build new compiler/scanner instances: deleted class candidates must disappear.
      clearRequireCache([...(dependenciesByEntry.get(entry) ?? [])])
      const files = new Set([entry])
      const compiler = await compile(input, {
        base: dirname(entry),
        from: entry,
        shouldRewriteUrls: true,
        onDependency: path => files.add(resolve(path)),
        customCssResolver: resolver,
        customJsResolver: resolver
      })
      const sources: SourceEntry[] = [
        ...(compiler.root === 'none'
          ? []
          : compiler.root === null
            ? [{ base, pattern: '**/*', negated: false }]
            : [{ ...compiler.root, negated: false }]),
        ...compiler.sources,
        ...excluded.map(directory => ({
          base: dirname(directory),
          pattern: posix(basename(directory)) + '/**',
          negated: true
        }))
      ]
      if (compiler.root && compiler.root !== 'none') {
        const root = resolve(compiler.root.base, compiler.root.pattern)
        if (!(await stat(root)).isDirectory())
          throw new Error(`Tailwind source() must point to a directory: ${root}`)
      }
      const scanner = new Scanner({ sources })
      const candidates = compiler.features & Features.Utilities ? scanner.scan() : []
      for (const path of scanner.files) files.add(resolve(path))
      let css = compiler.build(candidates)
      let map = options.sourcemap ? toSourceMap(compiler.buildSourceMap()).raw : undefined
      const rewritten = await rewriteUrls(
        css,
        entry,
        this,
        applyAlias,
        async path => {
          files.add(path)
          if (this.command === 'dev') await watcher?.watchFiles(entry, [path])
        },
        map
      )
      css = rewritten.css
      map = rewritten.map
      dependenciesByEntry.set(entry, files)
      if (this.command === 'build') for (const file of files) this.addWatchFile(file)
      else await watcher?.update(entry, { files, globs: scanner.globs })
      const optimization = options.optimize ?? this.command === 'build'
      if (optimization) {
        const result = optimize(css, {
          file: entry,
          minify: typeof optimization === 'object' ? (optimization.minify ?? true) : true,
          map
        })
        css = result.code
        map = result.map
      }
      if (map) css += '\n' + toSourceMap(map).comment(toSourceMap(map).inline)
      return this.emitAsset({ name: basename(entry), source: css, fileName: assetName(entry, css) })
    },
    closeBundle: close
  }
}

export { tailwindcss }
