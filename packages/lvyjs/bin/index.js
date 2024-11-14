#!/usr/bin/env node
import { fork } from 'child_process'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'fs'
const args = [...process.argv.slice(2)]
const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = dirname(currentFilePath)
const pkgFilr = join(currentDirPath, '../package.json')
// 启动模式
if (args.includes('build')) {
  const jsFile = join(currentDirPath, '../lib/index.js')
  const jsdir = relative(process.cwd(), jsFile)
  const argsx = args.filter(arg => arg !== 'build')
  let tsxDir = join(currentDirPath, '../../tsx/dist/cli.mjs')
  console.log('tsxDir', tsxDir)
  if (!existsSync(tsxDir)) {
    tsxDir = join(currentDirPath, '../node_modules/tsx/dist/cli.mjs')
  }
  const msg = fork(tsxDir, [jsdir, '--lvy-build', ...argsx], {
    stdio: 'inherit',
    env: Object.assign({}, process.env, {
      PKG_DIR: pkgFilr
    }),
    shell: process.platform === 'win32'
  })
  if (msg.error) {
    console.error(msg.error)
    process.exit()
  }
} else if (args.includes('dev')) {
  const jsFile = join(currentDirPath, '../lib/index.js')
  const jsdir = relative(process.cwd(), jsFile)
  const argsx = args.filter(arg => arg !== 'dev')
  const argv = [
    ...(args.includes('--no-watch') ? [] : ['watch', '--clear-screen=false']),
    jsdir,
    '--lvy-dev'
  ]
  let tsxDir = join(currentDirPath, '../../tsx/dist/cli.mjs')
  console.log('tsxDir', tsxDir)
  if (!existsSync(tsxDir)) {
    tsxDir = join(currentDirPath, '../node_modules/tsx/dist/cli.mjs')
  }
  const msg = fork(tsxDir, [...argv, ...argsx], {
    stdio: 'inherit',
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
