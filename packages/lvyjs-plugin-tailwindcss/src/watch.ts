import chokidar, { type FSWatcher } from 'chokidar'
import picomatch from 'picomatch'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type { DevContext } from 'lvyjs'

export type WatchSnapshot = { files: Set<string>; globs: { base: string; pattern: string }[] }
export const within = (path: string, directory: string) => {
  const part = relative(directory, path)
  return part === '' || (!part.startsWith(`..${sep}`) && part !== '..' && !isAbsolute(part))
}
const posix = (path: string) => path.split(sep).join('/')

/** Own the directory watch: LVY's literal file API cannot express filtered source globs. */
export class SourceWatcher {
  private watcher?: FSWatcher
  private timer?: ReturnType<typeof setTimeout>
  private snapshots = new Map<string, WatchSnapshot>()
  private matches: ((path: string) => boolean)[] = []
  private files = new Set<string>()
  private explicitModules: string[] = []
  private targets = new Set<string>()
  private ready?: Promise<void>
  private closed = false
  private updates = Promise.resolve()
  private settleReady?: () => void

  constructor(
    private dev: DevContext,
    private excluded: string[],
    private delay: number,
    private warn: (message: string) => void
  ) {}

  private ignored = (input: string) => {
    const path = resolve(input)
    if (this.excluded.some(directory => within(path, directory))) return true
    if (/(?:^|[\\/])(?:\.git|\.lvy)(?:[\\/]|$)/.test(path)) return true
    if (this.files.has(path)) return false
    if (/(?:^|[\\/])node_modules(?:[\\/]|$)/.test(path)) {
      return !this.explicitModules.some(
        directory => within(path, directory) || within(directory, path)
      )
    }
    return false
  }

  async watchFiles(entry: string, files: Iterable<string>) {
    const previous = this.snapshots.get(entry)
    await this.update(entry, {
      files: new Set([...(previous?.files ?? []), ...files]),
      globs: previous?.globs ?? []
    })
  }

  update(entry: string, snapshot: WatchSnapshot): Promise<void> {
    const pending = this.updates.then(() => this.updateSnapshot(entry, snapshot))
    this.updates = pending.catch(() => {})
    return pending
  }

  private async updateSnapshot(entry: string, snapshot: WatchSnapshot) {
    if (this.closed) return
    this.snapshots.set(entry, snapshot)
    this.files = new Set([...this.snapshots.values()].flatMap(value => [...value.files]))
    const globs = [...this.snapshots.values()].flatMap(value => value.globs)
    this.explicitModules = globs
      .filter(glob => /(?:^|[\\/])node_modules(?:[\\/]|$)/.test(glob.base))
      .map(glob => glob.base)
    this.matches = globs
      .filter(glob => !glob.pattern.startsWith('!'))
      .map(glob => {
        const match = picomatch(glob.pattern, { dot: false })
        return path => within(path, glob.base) && match(posix(relative(glob.base, path)))
      })
    const directories = globs.filter(glob => !glob.pattern.startsWith('!')).map(glob => glob.base)
    const roots = [...new Set(directories)].filter(
      path => !directories.some(parent => parent !== path && within(path, parent))
    )
    const targets = new Set([
      ...roots,
      ...[...this.files].filter(path => {
        // Project-wide scans skip node_modules; explicit compiler dependencies still need watches.
        const modulePath = /(?:^|[\\/])node_modules(?:[\\/]|$)/.test(path)
        const directoryCoversModules =
          !modulePath || this.explicitModules.some(root => within(path, root))
        return !directoryCoversModules || !roots.some(root => within(path, root))
      })
    ])
    const removed = [...this.targets].filter(path => !targets.has(path))
    // unwatch() permanently ignores paths even when a parent remains watched.
    // Recreate on subscription changes and await ready for newly added dependencies.
    // Ordinary scanned-file churn keeps the directory roots and does not rebuild.
    const added = [...targets].filter(path => !this.targets.has(path))
    if (this.watcher && (removed.length || added.length)) {
      await this.watcher.close()
      this.watcher = undefined
      this.ready = undefined
    }
    if (this.closed) return
    if (!this.watcher) {
      this.watcher = chokidar.watch([...targets], { ignoreInitial: true, ignored: this.ignored })
      this.watcher.on('all', (event, path) => {
        if (!['add', 'change', 'unlink'].includes(event) || this.ignored(path)) return
        const absolute = resolve(path)
        if (!this.files.has(absolute) && !this.matches.some(match => match(absolute))) return
        clearTimeout(this.timer)
        this.timer = setTimeout(() => {
          if (!this.closed) this.dev.restart()
        }, this.delay)
      })
      this.watcher.on('error', error => this.warn(`Source watch failed: ${String(error)}`))
      this.ready = new Promise<void>((resolveReady, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Tailwind source watch did not become ready')),
          30000
        )
        this.settleReady = () => {
          clearTimeout(timer)
          resolveReady()
        }
        this.watcher!.once('ready', this.settleReady)
        this.watcher!.once('error', error => {
          clearTimeout(timer)
          reject(error)
        })
      })
    } else {
      this.watcher.add([...targets].filter(path => !this.targets.has(path)))
    }
    this.targets = targets
    await this.ready
  }

  async close() {
    if (this.closed) return
    this.closed = true
    clearTimeout(this.timer)
    this.settleReady?.()
    await this.updates
    await this.watcher?.close()
    this.snapshots.clear()
  }
}
