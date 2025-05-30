import { existsSync } from 'fs'
import { join } from 'path'
import { RollupCommonJSOptions } from '@rollup/plugin-commonjs'
import { RollupTypescriptOptions } from '@rollup/plugin-typescript'
import { OutputOptions, RollupOptions } from 'rollup'
import { Alias } from './typing'

export type PluginsValue = (options: Options) => void

export type PluginsCallBack =
  | PluginsValue
  | {
      load?: PluginsValue
      build?: PluginsValue
    }

export type PluginsOptions = (options: Options) => PluginsCallBack | void

export type Options = {
  env?: {
    [key: string]: string
  }
  /**
   * 配置调整机及其回调插件
   */
  plugins?: PluginsOptions[]
  /**
   * 别名
   */
  alias?:
    | {
        /**
         * 别名规则
         */
        entries?: Alias[]
      }
    | false
  /**
   * 静态资源识别
   */
  assets?:
    | {
        /**
         * 过滤得到指定格式的文件识别之为静态资源
         */
        filter?: RegExp
      }
    | false
  styles?:
    | {
        /**
         * 过滤得到指定格式的文件识别之为静态资源
         */
        filter?: RegExp
      }
    | false
  /**
   * 打包时配置
   */
  build?:
    | {
        /**
         * cjs文件处理
         */
        commonjs?: RollupCommonJSOptions | false
        /**
         * ts配置
         */
        typescript?: RollupTypescriptOptions | false
        /**
         *
         */
        RollupOptions?: RollupOptions
        /**
         *
         */
        OutputOptions?: OutputOptions & {
          /**
           * 默认 src
           */
          input?: string
        }
      }
    | false
}

/**
 *
 */
declare global {
  var lvyConfig: Options
}

/**
 *
 */
export const initConfig = async () => {
  if (!global.lvyConfig) global.lvyConfig = {}
  const files = [
    'lvy.config.ts',
    'lvy.config.js',
    'lvy.config.mjs',
    'lvy.config.cjs',
    'lvy.config.tsx'
  ]
  let configDir = ''
  for (const file of files) {
    if (existsSync(file)) {
      configDir = file
      break
    }
  }
  if (configDir !== '') {
    const v = await import(`file://${join(process.cwd(), configDir)}`)
    if (v?.default) {
      global.lvyConfig = v.default
      if (global.lvyConfig?.env) {
        for (const key in global.lvyConfig.env) {
          process.env[key] = String(global.lvyConfig.env[key])
        }
      }
      process.env.NODE_ENV = process.env?.NODE_ENV || 'development'
    }
  }
}

/**
 * @returns
 */
export const getOptions = () => global.lvyConfig

/**
 * @param param0
 * @returns
 */
export const defineConfig = (optoins?: Options) => optoins
