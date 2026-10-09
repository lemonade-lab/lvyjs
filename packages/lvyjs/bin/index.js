#!/usr/bin/env node

import { fork } from 'child_process'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'node:url'
import chokidar from 'chokidar'
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
  let killTimeout = null // SIGKILL 超时定时器
  let restartDebounceTimer = null // 重启防抖定时器
  let latestConfig = null // 最新待应用的配置
  let fileWatcher = null // chokidar watcher 实例
  let watchDebounce = null // watch 防抖定时器
  let pluginConnection
  let pluginWatchFiles = []

  // 解析 watch 配置
  const parseWatchConfig = data => {
    const w = data?.watch
    if (!w) return { paths: [], delay: 500 }
    if (Array.isArray(w)) return { paths: w, delay: 500 }
    if (typeof w === 'object' && w.paths) {
      return { paths: w.paths, delay: w.delay || 500 }
    }
    return { paths: [], delay: 500 }
  }

  // 关闭 watcher
  const closeFileWatcher = async () => {
    if (watchDebounce) {
      clearTimeout(watchDebounce)
      watchDebounce = null
    }
    const watcher = fileWatcher
    fileWatcher = null
    await watcher?.close()
  }

  // 启动 watch 监听（支持 glob 模式，如 'src/**/*.{ts,tsx}'）
  const startFileWatcher = data => {
    const oldWatcher = fileWatcher
    fileWatcher = null
    if (watchDebounce) clearTimeout(watchDebounce)
    oldWatcher?.close()
    const { paths: configuredPaths, delay } = parseWatchConfig(data)
    const paths = [...configuredPaths, ...pluginWatchFiles]
    if (paths.length === 0) return

    fileWatcher = chokidar.watch(paths, {
      cwd: process.cwd(),
      ignoreInitial: true,
      ignored: /(^|[\/\\])\../ // 忽略点文件
    })

    fileWatcher.on('all', (_event, filePath) => {
      if (watchDebounce) clearTimeout(watchDebounce)
      watchDebounce = setTimeout(() => {
        watchDebounce = null
        console.info(`[lvyjs] 监听到文件变化: ${filePath}，正在重启...`)
        doRestart(latestConfig || data)
      }, delay)
    })

    fileWatcher.on('ready', () => {})
  }

  // 启动开发进程
  const startDevProcess = data => {
    // 如果正在等待重启，先不启动
    if (pendingRestart || shuttingDown) return
    const envConfig = data?.env || {}
    // 前面1个被占用，剩余参数
    const restArgs = args.slice(1)

    // 如果支持，得到 watch 配置，启动watch。
    // 当watch的配置发生变化时，重启开发进程
    // 复用当前的重启逻辑。
    startFileWatcher(data)

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
        __LVYJS_PLUGIN_CONNECTION: pluginConnection ? JSON.stringify(pluginConnection) : '',
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
      if (code !== 0 && !pendingRestart && !shuttingDown) {
        console.info('[lvyjs] 开发进程异常退出，等待配置重新加载...')
      }
    })
  }

  // 优雅重启开发进程（带防抖，避免密集重启）
  const restartDevProcess = newConfig => {
    // 保存最新配置，防抖后使用
    latestConfig = newConfig

    if (restartDebounceTimer) clearTimeout(restartDebounceTimer)
    restartDebounceTimer = setTimeout(() => {
      restartDebounceTimer = null
      doRestart(latestConfig)
    }, 500)
  }

  const doRestart = config => {
    // 关闭旧的文件监听
    closeFileWatcher()

    if (!devProcess) {
      // 没有运行中的进程，直接启动
      startDevProcess(config)
      return
    }

    // 如果已经在等待重启，只更新配置，不重复 kill
    if (pendingRestart) {
      latestConfig = config
      return
    }

    pendingRestart = true
    console.info('[lvyjs] 配置已更新，正在重启开发进程...')

    // 监听退出事件，确保旧进程完全结束后再启动新进程
    devProcess.once('exit', () => {
      // 清除 SIGKILL 超时定时器
      if (killTimeout) {
        clearTimeout(killTimeout)
        killTimeout = null
      }
      pendingRestart = false
      // 使用最新的配置启动
      startDevProcess(latestConfig || config)
    })

    // 发送终止信号
    devProcess.kill('SIGTERM')

    // 超时保护：如果 5 秒后还没退出，强制杀掉
    killTimeout = setTimeout(() => {
      killTimeout = null
      if (devProcess) {
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
    if (msg.type === 'pluginWatch') {
      if (!pluginWatchFiles.includes(msg.path)) pluginWatchFiles.push(msg.path)
      if (fileWatcher) fileWatcher.add(msg.path)
      else if (devProcess && latestConfig) startFileWatcher(latestConfig)
      return
    }
    if (msg.type === 'pluginRestart') {
      if (latestConfig) restartDevProcess(latestConfig)
      return
    }
    if (msg.type === 'error' || msg.error) {
      console.error('[lvyjs] 配置进程错误:', msg.error)
      shutdown(1)
    }

    if (msg.type === 'configReady') {
      pluginConnection = msg.payload.connection
      pluginWatchFiles = msg.payload.watchFiles || []
      restartDevProcess(msg.payload.data)
    }
  })

  readConfigFork.on('error', error => {
    console.error('[lvyjs] 读取配置文件时发生错误:', error)
    shutdown(1)
  })

  // 配置进程意外退出
  readConfigFork.on('exit', code => {
    if (!shuttingDown) {
      if (devProcess) devProcess.kill()
      console.error(`[lvyjs] 配置进程意外退出 (${code})`)
      process.exit(1)
    }
  })

  // Allow plugin cleanup to finish before terminating the host.
  let shuttingDown = false
  const shutdown = (code = 0) => {
    if (shuttingDown) return
    shuttingDown = true
    clearTimeout(restartDebounceTimer)
    clearTimeout(killTimeout)
    console.log('\n[lvyjs] 正在退出...')
    closeFileWatcher()
    if (devProcess) devProcess.kill()
    if (readConfigFork.connected) readConfigFork.send({ type: 'pluginClose' })
    else process.exit(code)
    readConfigFork.once('exit', () => process.exit(code))
    setTimeout(() => {
      readConfigFork.kill('SIGKILL')
      process.exit(code)
    }, 5000).unref()
  }
  process.on('SIGINT', () => shutdown())
  process.on('SIGTERM', () => shutdown())
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
  msg.on('error', error => {
    console.error(error)
    process.exitCode = 1
  })
  msg.on('exit', code => {
    process.exitCode = code ?? 1
  })
}

if (mode === 'build') {
  build()
} else {
  dev()
}
