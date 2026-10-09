import { createServer, type Socket } from 'node:net'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import chokidar from 'chokidar'
import { tsImport } from 'tsx/esm/api'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { transpileJavascript } from './javascript'
import { devBuiltinPlugins } from './dev-builtins'
import { configFiles } from './config'
import { createPluginContainer, type PluginContainer } from './plugin'

let container: PluginContainer | undefined
let reloading = Promise.resolve()
const token = randomUUID()
const sockets = new Set<Socket>()
const server = createServer(socket => {
  socket.setNoDelay(true)
  sockets.add(socket)
  socket.on('close', () => sockets.delete(socket))
  socket.on('error', () => socket.destroy())
  socket.setEncoding('utf8')
  let input = ''
  socket.on('data', data => {
    input += data
    let index: number
    while ((index = input.indexOf('\n')) >= 0) {
      const line = input.slice(0, index)
      input = input.slice(index + 1)
      try {
        const request = JSON.parse(line)
        if (request.token !== token) {
          socket.destroy()
          return
        }
        handleRequest(request)
          .then(response => {
            if (!socket.destroyed) socket.write(JSON.stringify(response) + '\n')
          })
          .catch(error => {
            if (!socket.destroyed)
              socket.write(
                JSON.stringify({ requestId: request.requestId, error: String(error) }) + '\n'
              )
          })
      } catch {
        socket.destroy()
        return
      }
    }
  })
})
await new Promise<void>((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
const address = server.address()
if (!address || typeof address === 'string') throw new Error('[lvyjs] Failed to start plugin host')
const connection = { port: address.port, token }
const packageLib = fileURLToPath(new URL('.', import.meta.url))
const configWatcher = chokidar.watch(configFiles, { cwd: process.cwd(), ignoreInitial: true })
let reloadTimer: ReturnType<typeof setTimeout> | undefined
configWatcher.on('all', () => {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(scheduleReload, 300)
})
const watchFiles = new Set<string>()
const addWatchFile = (file: string) => {
  const path = resolve(file)
  watchFiles.add(path)
  process.send?.({ type: 'pluginWatch', path })
}

const reload = async () => {
  await container?.close()
  container = undefined
  watchFiles.clear()
  const configFile = configFiles.find(file => existsSync(file))
  const raw = configFile
    ? ((
        await tsImport(pathToFileURL(join(process.cwd(), configFile)).href, {
          parentURL: import.meta.url,
          onImport(url) {
            if (!url.startsWith('file:')) return
            const path = fileURLToPath(url)
            if (!path.includes('/node_modules/') && !path.startsWith(packageLib))
              configWatcher.add(path)
          }
        })
      ).default ?? {})
    : {}
  const resolved = await createPluginContainer(
    raw,
    { command: 'dev', cwd: process.cwd() },
    addWatchFile,
    devBuiltinPlugins
  )
  container = resolved.container
  global.lvyConfig = resolved.config
  await container.configureDev({
    cwd: process.cwd(),
    addWatchFile,
    restart: () => process.send?.({ type: 'pluginRestart' })
  })
  // Functions stay in this process. Only runtime settings travel across IPC.
  const data = JSON.parse(
    JSON.stringify(resolved.config, (key, value) => {
      if (key === 'plugins' || typeof value === 'function') return undefined
      if (value instanceof RegExp)
        return { __regexp: true, source: value.source, flags: value.flags }
      return value
    })
  )
  process.send?.({
    type: 'configReady',
    payload: {
      data,
      connection: container.plugins.length > 0 ? connection : undefined,
      watchFiles: [...watchFiles]
    }
  })
}

const scheduleReload = () => {
  reloading = reloading.then(reload).catch(error => {
    console.error(error)
    process.send?.({ type: 'error', error: error instanceof Error ? error.message : String(error) })
  })
}

async function handleRequest(message: any) {
  try {
    await reloading
    if (!container) throw new Error('Plugin host is not ready')
    const { method, args } = message
    let result: unknown
    if (method === 'resolveId') result = await container.resolveId(args[0], args[1])
    else if (method === 'load') result = await container.load(args[0])
    else if (method === 'transform') {
      const compiled = await transpileJavascript(args[0], args[1], process.cwd())
      const transformed = await container.transform(compiled.code, args[1], compiled.map)
      result = transformed ?? (/\.(?:[cm]?ts|tsx|jsx)$/.test(args[1]) ? compiled : null)
    } else throw new Error(`Unknown plugin method: ${method}`)
    return { requestId: message.requestId, result }
  } catch (error) {
    return {
      requestId: message.requestId,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
process.on('message', message => {
  if ((message as any).type === 'pluginClose') void shutdown()
})

scheduleReload()
let closing = false
const shutdown = async () => {
  if (closing) return
  closing = true
  clearTimeout(reloadTimer)
  await configWatcher.close()
  for (const socket of sockets) socket.destroy()
  server.close()
  try {
    await container?.close()
  } catch (error) {
    console.error(error)
  }
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

process.on('disconnect', shutdown)
