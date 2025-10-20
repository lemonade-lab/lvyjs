#!/usr/bin/env node

import { fork } from 'child_process'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'node:url'
const args = [...process.argv.slice(2)]
const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = dirname(currentFilePath)
const pkgFilr = join(currentDirPath, '../package.json')
const jsFile = join(currentDirPath, '../lib/index.js')
const jsdir = relative(process.cwd(), jsFile)
// 构建时，使用 rollup
if (args.includes('build')) {
  const argsx = args.filter(arg => arg !== 'build')
  const msg = fork(jsdir, ['--lvy-build', ...argsx], {
    stdio: 'inherit',
    execArgv: [...process.execArgv, '--require', 'tsx/preflight', '--import', 'tsx'],
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
  const msg = fork(jsdir, ['--lvy-dev', ...argsx], {
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
