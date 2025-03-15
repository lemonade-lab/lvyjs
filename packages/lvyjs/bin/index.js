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
const jsdir = relative(process.cwd(), jsFile)
const require = createRequire(import.meta.url)
const tsxDir = require.resolve('tsx/cli')
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
