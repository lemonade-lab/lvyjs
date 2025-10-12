#!/usr/bin/env node

import { fork } from 'child_process'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const args = [...process.argv.slice(2)]
const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = dirname(currentFilePath)
const pkgFilr = join(currentDirPath, '../package.json')
const jsFile = join(currentDirPath, '../lib/index.js')
const loaderFile = join(currentDirPath, '../lib/main.js')
const jsdir = relative(process.cwd(), jsFile)
const require = createRequire(import.meta.url)
// const tsxDir = require.resolve('tsx/cli')
// 构建时，使用 rollup
if (args.includes('build')) {
  const argsx = args.filter(arg => arg !== 'build')
  const msg = fork(jsdir, ['--lvy-build', ...argsx], {
    stdio: 'inherit',
    // 自己挂 execArgv
    execArgv: [
      ...process.execArgv,
      '--require',
      require.resolve('tsx/preflight'),
      '--import',
      require.resolve('tsx')
    ],
    env: Object.assign({}, process.env, {
      PKG_DIR: pkgFilr
    }),
    shell: process.platform === 'win32'
  })
  if (msg.error) {
    console.error(msg.error)
    process.exit()
  }
  // 运行时，使用 tsx
} else if (args.includes('dev')) {
  const argsx = args.filter(arg => arg !== 'dev')
  const argv = [jsdir, '--lvy-dev']
  if (!args.includes('--no-watch')) {
    argv.unshift('--clear-screen=false')
    argv.unshift('watch')
  }
  const msg = fork(jsdir, [...argv, ...argsx], {
    stdio: 'inherit',
    // 自己挂 execArgv
    execArgv: [
      ...process.execArgv,
      '--require',
      require.resolve('tsx/preflight'),
      '--import',
      require.resolve('tsx'),
      '--import',
      loaderFile
    ],
    env: Object.assign({}, process.env, {
      PKG_DIR: pkgFilr
    }),
    shell: process.platform === 'win32'
  })
  if (msg.error) {
    console.error(msg.error)
    process.exit()
  }
}
