import { InputPluginOption, LoggingFunction, rollup, RollupLog } from 'rollup'
import { join } from 'path'
import typescript from '@rollup/plugin-typescript'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import styles from 'rollup-plugin-styles'
import { getScriptFiles } from './get-files'
import alias from '@rollup/plugin-alias'
import { rollupAssets, rollupStylesCSSImport } from '../plugins/index'

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

  if (global.lvyConfig?.alias) {
    plugins.push(alias(global.lvyConfig.alias))
  }

  if (global.lvyConfig.assets) {
    plugins.push(rollupAssets(global.lvyConfig.assets))
  } else {
    plugins.push(rollupAssets())
  }

  if (typeof global.lvyConfig.build != 'boolean') {
    //
    for (const key in global.lvyConfig.build) {
      if (typeof global.lvyConfig.build[key] == 'boolean') {
        continue
      }
      if (key === 'styles') {
        plugins.push(
          styles({
            mode: ['inject', () => '']
          })
        )
        plugins.push(rollupStylesCSSImport(global.lvyConfig.build[key]))
      } else if (key === 'commonjs' && !global.lvyConfig.build['@rollup/plugin-commonjs']) {
        plugins.push(commonjs(global.lvyConfig.build[key]))
      } else if (key === 'json' && !global.lvyConfig.build['@rollup/plugin-json']) {
        plugins.push(json(global.lvyConfig.build[key]))
      } else if (key === 'typescript' && !global.lvyConfig.build['@rollup/plugin-typescript']) {
        plugins.push(typescript(global.lvyConfig.build[key]))
      } else if (key === 'plugins') {
        if (Array.isArray(global.lvyConfig.build[key])) {
          for (const plugin of global.lvyConfig.build[key]) {
            plugins.push(plugin)
          }
        }
      } else {
        const plugin = (await import(key)).default
        plugins.push(plugin(global.lvyConfig.build[key]))
      }
    }

    // 如果不存在这些配置
    const keys = ['styles', 'commonjs', 'json', 'typescript']

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
      if (key == 'styles') {
        plugins.push(
          styles({
            mode: ['inject', () => '']
          })
        )
        plugins.push(rollupStylesCSSImport())
      } else if (key === 'commonjs') {
        plugins.push(commonjs())
      } else if (key === 'json') {
        plugins.push(json())
      } else if (key === 'typescript') {
        plugins.push(typescript())
      }
    }
  }

  // rollup 配置
  const rollupOptions = global.lvyConfig?.rollupOptions ?? {}
  const rollupPlugins = global.lvyConfig?.rollupPlugins ?? []

  // build
  const bundle = await rollup({
    input: inputs,
    plugins: [...plugins, ...rollupPlugins],
    onwarn: onwarn
  })

  // 写入输出文件
  await bundle.write({
    dir: 'lib',
    format: 'es',
    sourcemap: false,
    preserveModules: true,
    assetFileNames: 'assets/[name]-[hash][extname]',
    ...rollupOptions
  })
}

/**
 *
 * @param script
 */
export async function buildAndRun() {
  // rollup 配置
  let inputDir = 'src'
  if (global.lvyConfig?.rollupOptions?.input) {
    inputDir = global.lvyConfig.rollupOptions.input
    delete global.lvyConfig.rollupOptions['input']
  }
  const inputFiles = getScriptFiles(join(process.cwd(), inputDir))
  await buildJS(inputFiles)
}
