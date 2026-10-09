import { connect, type Socket } from 'node:net'
export type PluginConnection = { port: number; token: string }
let socket: Socket
let sequence = 0
let input = ''
const pending = new Map<
  number,
  { resolve(value: any): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }
>()
let connection: PluginConnection
const fail = (error: Error) => {
  for (const request of pending.values()) {
    clearTimeout(request.timer)
    request.reject(error)
  }
  pending.clear()
}
export async function initializePluginRpc(options: PluginConnection) {
  connection = options
  socket = connect({ host: '127.0.0.1', port: options.port })
  socket.setNoDelay(true)
  socket.setEncoding('utf8')
  socket.on('data', data => {
    input += data
    let index: number
    while ((index = input.indexOf('\n')) >= 0) {
      const line = input.slice(0, index)
      input = input.slice(index + 1)
      try {
        const message = JSON.parse(line)
        const request = pending.get(message.requestId)
        if (!request) continue
        pending.delete(message.requestId)
        clearTimeout(request.timer)
        if (message.error) request.reject(new Error(message.error))
        else request.resolve(message.result)
      } catch (cause) {
        fail(new Error(`[lvyjs] Invalid plugin response: ${cause}`))
      }
    }
    if (!pending.size) socket.unref()
  })
  socket.on('error', error => fail(error))
  socket.on('close', () => fail(new Error('[lvyjs] Plugin host disconnected')))
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('error', reject)
  })
  socket.unref()
}
export function pluginRequest(method: string, ...args: unknown[]): Promise<any> {
  const requestId = ++sequence
  return new Promise((resolve, reject) => {
    if (socket.destroyed) {
      reject(new Error('[lvyjs] Plugin host disconnected'))
      return
    }
    socket.ref()
    const timer = setTimeout(() => {
      pending.delete(requestId)
      if (!pending.size) socket.unref()
      reject(new Error(`[lvyjs] Plugin request timed out: ${method}`))
    }, 30000)
    pending.set(requestId, { resolve, reject, timer })
    socket.write(JSON.stringify({ token: connection.token, requestId, method, args }) + '\n')
  })
}
