import { fork } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { PluginConnection } from './plugin-rpc'

/** Standalone --import lvyjs/register also needs a host independent of the app thread. */
export async function startDevHost(): Promise<{ data: any; connection?: PluginConnection }> {
  const env = { ...process.env }
  delete env.__LVYJS_REGISTER_CONFIG
  delete env.__LVYJS_PLUGIN_CONNECTION
  const child = fork(fileURLToPath(new URL('./readConfig.js', import.meta.url)), [], {
    execArgv: ['--require', 'tsx/preflight', '--import', 'tsx'],
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    env
  })
  const ready = await new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('[lvyjs] Plugin host startup timed out'))
    }, 30000)
    const cleanup = () => {
      clearTimeout(timer)
      child.off('error', onError)
      child.off('exit', onExit)
      child.off('message', onMessage)
    }
    const onError = (error: Error) => {
      cleanup()
      child.kill()
      reject(error)
    }
    const onExit = () => onError(new Error('[lvyjs] Plugin host exited before becoming ready'))
    const onMessage = (message: any) => {
      if (message.type === 'error') onError(new Error(message.error))
      if (message.type === 'configReady') {
        cleanup()
        resolve(message.payload)
      }
    }
    child.on('error', onError)
    child.on('exit', onExit)
    child.on('message', onMessage)
  })
  const close = (exit?: () => void) => {
    if (!child.connected) {
      exit?.()
      return
    }
    child.ref()
    child.channel?.ref()
    child.once('exit', () => exit?.())
    child.send({ type: 'pluginClose' })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      exit?.()
    }, 5000)
    child.once('exit', () => clearTimeout(timer))
  }
  child.on('error', error => console.error('[lvyjs] Plugin host:', error))
  child.unref()
  child.channel?.unref()
  process.once('beforeExit', () => close())
  process.once('exit', () => child.kill('SIGTERM'))
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => close(() => process.exit(0)))
  }
  return ready
}
