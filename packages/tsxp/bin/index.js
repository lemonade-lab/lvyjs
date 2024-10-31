#!/usr/bin/env node
import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'node:url'
const args = [...process.argv.slice(2)]
const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = dirname(currentFilePath)
const jsFile = join(currentDirPath, '../lib/index.js')
const jsDir = relative(process.cwd(), jsFile)
// 启动模式
if (args.includes('dev')) {
  let argsx = args.filter(arg => arg !== 'dev')
  const index = args.indexOf('--node-options')
  const loader = index > -1 ? args[index + 1] : undefined
  if (loader) {
    const msg = spawn(
      'npx',
      ['tsx', 'watch', '--clear-screen=false', jsDir, '--tsxp-server', ...argsx],
      {
        stdio: 'inherit',
        env: Object.assign({}, process.env, {
          NODE_OPTIONS: `--loader ${loader} --no-warnings`
        }),
        shell: process.platform === 'win32'
      }
    )
    if (msg.error) {
      console.error(msg.error)
      process.exit()
    }
  } else {
    const msg = spawn(
      'npx',
      ['tsx', 'watch', '--clear-screen=false', jsDir, '--tsxp-server', ...argsx],
      {
        stdio: 'inherit',
        shell: process.platform === 'win32'
      }
    )
    if (msg.error) {
      console.error(msg.error)
      process.exit()
    }
  }
}
