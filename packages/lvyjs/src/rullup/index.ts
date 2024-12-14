import { InputPluginOption, LoggingFunction, rollup, RollupLog } from 'rollup'
import { join } from 'path'
import typescript from '@rollup/plugin-typescript'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import styles from 'rollup-plugin-styles'
import { getScriptFiles } from './utils/files'
import alias from '@rollup/plugin-alias'
import { rollupAssets, rollupStylesCSSImport } from './plugins/index'

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
    const newAlias = val => {
      const alias = {}
      // 遍历 entries 数组
      val.entries.forEach(entry => {
        alias[entry.find] = entry.replacement
      })
      return alias
    }
    plugins.push(
      styles({
        alias: newAlias(global.lvyConfig?.alias),
        mode: ['inject', () => '']
      })
    )
    plugins.push(rollupStylesCSSImport(global.lvyConfig.styles))
  }

  plugins.push(json())

  if (typeof global.lvyConfig.build != 'boolean') {
    //
    for (const key in global.lvyConfig.build) {
      if (typeof global.lvyConfig.build[key] == 'boolean') {
        continue
      }
      if (key == 'commonjs' && !global.lvyConfig.build['@rollup/plugin-commonjs']) {
        plugins.push(commonjs(global.lvyConfig.build[key]))
      } else if (key == 'typescript' && !global.lvyConfig.build['@rollup/plugin-typescript']) {
        plugins.push(typescript(global.lvyConfig.build[key]))
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
  const OutputOptions = global.lvyConfig?.build?.OutputOptions ?? []

  // build
  const bundle = await rollup({
    input: inputs,
    plugins: [...plugins],
    onwarn: onwarn,
    ...RollupOptions
  })

  // 写入输出文件
  await bundle.write({
    dir: 'lib',
    format: 'es',
    sourcemap: false,
    preserveModules: true,
    assetFileNames: 'assets/[name]-[hash][extname]',
    ...OutputOptions
  })
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
