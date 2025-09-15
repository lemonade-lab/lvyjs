import { InputPluginOption, LoggingFunction, rollup, RollupLog } from 'rollup'
import { join } from 'path'
import typescript from '@rollup/plugin-typescript'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import styles from 'rollup-plugin-styles'
import { getScriptFiles } from './utils/files'
import alias from '@rollup/plugin-alias'
import { rollupAssets, rollupStylesCSSImport } from './plugins/index'
import { createAlias } from '../config'
import { readFileSync, statSync } from 'fs'
import zlib from 'zlib'

/**
 * 用于忽略警告
 * @param warning
 * @param warn
 */
const onwarn = (warning: RollupLog, warn: LoggingFunction) => {
  if (warning.code === 'UNRESOLVED_IMPORT') return
  warn(warning)
}

/**
 * 打包 JS
 * *** 注意 **
 * 和initConfig配合使用
 * **
 * 确保已经初始化了配置
 * @param inputs
 * @param output
 */
export const buildJS = async (inputs: string[]) => {
  if (!global.lvyConfig) global.lvyConfig = {}
  if (!global.lvyConfig.build) global.lvyConfig.build = {}

  // 插件
  const plugins: InputPluginOption = []

  if (typeof global.lvyConfig?.alias !== 'boolean') {
    plugins.push(alias(global.lvyConfig?.alias ?? {}))
  }

  if (typeof global.lvyConfig?.assets !== 'boolean') {
    plugins.push(rollupAssets(global.lvyConfig?.assets ?? {}))
  }

  if (typeof global.lvyConfig?.styles !== 'boolean') {
    if (!global.lvyConfig.alias) global.lvyConfig.alias = {}
    plugins.push(
      styles({
        alias: createAlias(global.lvyConfig?.alias),
        mode: ['inject', () => '']
      })
    )
    plugins.push(rollupStylesCSSImport(global.lvyConfig.styles))
  }

  plugins.push(json())

  const OutputOptions = global.lvyConfig?.build?.OutputOptions ?? []

  // 获取 dir 的值
  const outputDir = OutputOptions['dir'] || 'lib'

  if (typeof global.lvyConfig.build != 'boolean') {
    //
    for (const key in global.lvyConfig.build) {
      if (typeof global.lvyConfig.build[key] == 'boolean') {
        continue
      }
      if (key == 'commonjs' && !global.lvyConfig.build['@rollup/plugin-commonjs']) {
        plugins.push(commonjs(global.lvyConfig.build[key]))
      } else if (key == 'typescript' && !global.lvyConfig.build['@rollup/plugin-typescript']) {
        const config = global.lvyConfig.build[key] || {}
        if (config.declarationDir === undefined) {
          config.declarationDir = outputDir
        }
        plugins.push(typescript(config))
      } else if (key == 'OutputOptions') {
        continue
      } else if (key == 'RollupOptions') {
        continue
      }
    }

    // 如果不存在这些配置
    const keys = ['commonjs', 'typescript']

    for (const key of keys) {
      // 如果是布尔值
      if (typeof global.lvyConfig.build[key] == 'boolean') {
        continue
      }
      // 存在这些配置
      if (global.lvyConfig.build[key]) {
        continue
      }
      //
      if (key === 'commonjs') {
        plugins.push(commonjs())
      } else if (key === 'typescript') {
        plugins.push(typescript())
      }
    }
  }

  const RollupOptions = global.lvyConfig?.build?.RollupOptions ?? {}
  const plg = await RollupOptions?.plugins
  const pl = plg && typeof plg != 'boolean' ? plg : []

  // build
  const bundle = await rollup({
    input: inputs,
    onwarn: onwarn,
    ...RollupOptions,
    plugins: Array.isArray(pl) ? [...plugins, ...pl] : pl
  })

  // 写入输出文件
  const { output } = await bundle.write({
    dir: outputDir,
    format: 'es',
    sourcemap: false,
    preserveModules: true,
    assetFileNames: 'assets/[name]-[hash][extname]',
    ...OutputOptions
  })

  // 打印产出地址和文件大小
  console.log(`✓ ${output.length} modules transformed.`)
  for (const file of output) {
    const filePath = join(outputDir, file.fileName)
    const fileSize = statSync(filePath).size
    const fileContent = readFileSync(filePath)
    const gzipFileSize = zlib.gzipSync(fileContent).length
    console.log(
      `${filePath.padEnd(40)} ${(fileSize / 1024).toFixed(2)} kB │ gzip: ${(
        gzipFileSize / 1024
      ).toFixed(2)} kB`
    )
  }

  //
}

/**
 *
 * @param script
 */
export async function buildAndRun() {
  if (!global.lvyConfig) global.lvyConfig = {}
  if (!global.lvyConfig.build) global.lvyConfig.build = {}
  // rollup 配置
  let inputDir = global.lvyConfig?.build?.OutputOptions?.input ?? 'src'
  const inputFiles = getScriptFiles(join(process.cwd(), inputDir))
  await buildJS(inputFiles)
}
