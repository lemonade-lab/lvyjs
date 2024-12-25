#!/usr/bin/env node

import { fork } from 'child_process'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'fs'
const args = [...process.argv.slice(2)]
const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = dirname(currentFilePath)
const pkgFilr = join(currentDirPath, '../package.json')
const jsFile = join(currentDirPath, '../lib/index.js')
const jsdir = relative(process.cwd(), jsFile)
let tsxDir = join(currentDirPath, '../../tsx/dist/cli.mjs')
if (!existsSync(tsxDir)) {
  tsxDir = join(currentDirPath, '../node_modules/tsx/dist/cli.mjs')
}
if (!existsSync(tsxDir)) {
  tsxDir = join(process.cwd(), 'node_modules/tsx/dist/cli.mjs')
}
if (!existsSync(tsxDir)) {
  new Error('无法搜寻tsx')
}

if (args.includes('build')) {
  const argsx = args.filter(arg => arg !== 'build')
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
  const argsx = args.filter(arg => arg !== 'dev')
  const argv = [jsdir, '--lvy-dev']
  if (!args.includes('--no-watch')) {
    argv.unshift('--clear-screen=false')
    argv.unshift('watch')
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
