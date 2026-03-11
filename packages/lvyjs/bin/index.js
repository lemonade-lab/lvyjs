#!/usr/bin/env node

import { fork } from 'child_process'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'node:url'
const args = [...process.argv.slice(2)]
const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = dirname(currentFilePath)
const indexJavaScriptDir = join(currentDirPath, '../lib/index.js')
const readConfigJavaScriptDir = relative(
  process.cwd(),
  join(currentDirPath, '../lib/readConfig.js')
)

const mode = args[0]

const dev = () => {
  const indexFileDir = args[0]
  if (!indexFileDir) {
    console.error('[lvyjs] 请指定入口文件')
    process.exit(1)
  }

  let devProcess = null
  let pendingRestart = false // 标记是否有重启 pending

  // 启动开发进程
  const startDevProcess = data => {
    // 如果正在等待重启，先不启动
    if (pendingRestart) return
    const envConfig = data?.env || {}
    // 前面1个被占用，剩余参数
    const restArgs = args.slice(1)
    devProcess = fork(indexFileDir, restArgs, {
      stdio: 'inherit',
      execArgv: [
        ...process.execArgv,
        '--require',
        'tsx/preflight',
        '--import',
        'tsx',
        '--import',
        'lvyjs/register'
      ],
      env: {
        ...process.env,
        ...envConfig,
        __LVYJS_REGISTER_CONFIG: JSON.stringify(data) // 传递配置给子进程
      },
      shell: process.platform === 'win32'
    })

    // 监听错误
    devProcess.on('error', err => {
      console.error('[lvyjs] 开发进程错误:', err)
    })

    // 进程退出时清空引用
    devProcess.on('exit', (code, signal) => {
      console.info(`[lvyjs] 开发进程退出 (${code || signal})`)
      devProcess = null

      // 如果是异常退出，可以尝试重启
      if (code !== 0 && !pendingRestart) {
        console.info('[lvyjs] 开发进程异常退出，等待配置重新加载...')
      }
    })
  }

  // 优雅重启开发进程
  const restartDevProcess = newConfig => {
    if (!devProcess) {
      // 没有运行中的进程，直接启动
      startDevProcess(newConfig)
      return
    }

    pendingRestart = true
    console.info('[lvyjs] 配置已更新，正在重启开发进程...')

    // 监听退出事件，确保旧进程完全结束后再启动新进程
    devProcess.once('exit', () => {
      pendingRestart = false
      startDevProcess(newConfig)
    })

    // 发送终止信号
    devProcess.kill('SIGTERM')

    // 超时保护：如果 5 秒后还没退出，强制杀掉
    setTimeout(() => {
      if (devProcess && !devProcess.killed) {
        console.info('[lvyjs] 开发进程无响应，强制终止')
        devProcess.kill('SIGKILL')
      }
    }, 5000)
  }

  // 启动配置进程
  const readConfigFork = fork(readConfigJavaScriptDir, [], {
    // stdio: 'inherit',
    execArgv: [...process.execArgv, '--require', 'tsx/preflight', '--import', 'tsx'],
    env: Object.assign({}, process.env, {}),
    shell: process.platform === 'win32'
  })

  readConfigFork.on('message', msg => {
    if (msg.error) {
      console.error('[lvyjs] 配置进程错误:', msg.error)
      process.exit(1)
    }

    if (msg.type === 'configReady') {
      restartDevProcess(msg.payload.data)
    }
  })

  readConfigFork.on('error', error => {
    console.error('[lvyjs] 读取配置文件时发生错误:', error)
    process.exit(1)
  })

  // 配置进程意外退出
  readConfigFork.on('exit', code => {
    if (code !== 0) {
      console.error(`[lvyjs] 配置进程意外退出 (${code})`)
      process.exit(1)
    }
  })

  // 处理主进程退出
  process.on('SIGINT', () => {
    console.log('\n[lvyjs] 正在退出...')
    if (devProcess) devProcess.kill()
    if (readConfigFork) readConfigFork.kill()
    process.exit(0)
  })
}

const build = () => {
  // 剩余参数
  const restArgs = args.slice(1)
  const msg = fork(indexJavaScriptDir, ['--lvy-build', ...restArgs], {
    stdio: 'inherit',
    execArgv: [...process.execArgv, '--require', 'tsx/preflight', '--import', 'tsx'],
    env: Object.assign({}, process.env, {}),
    shell: process.platform === 'win32'
  })
  if (msg.error) {
    console.error(msg.error)
    process.exit()
  }
}

if (mode === 'build') {
  build()
} else {
  dev()
}
