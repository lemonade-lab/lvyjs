import { RollupAliasOptions } from '@rollup/plugin-alias'
import { existsSync } from 'fs'
import { join } from 'path'
import { RollupOptions } from 'rollup'
import { RollupStylesCSSImportOptions } from '../plugins/loader-css'
import { RollupCommonJSOptions } from '@rollup/plugin-commonjs'
import { RollupJsonOptions } from '@rollup/plugin-json'
import { RollupTypescriptOptions } from '@rollup/plugin-typescript'
import { SameShape, BuildOptions } from 'esbuild'
import { RollupAssetsOptions } from '../plugins/index'
import { ESBuildAsstesOptions, ESBuildCSSOptions } from './plugins'

export type Options = {
  /**
   * 配置调整机及其回调插件
   */
  plugins?: {
    /**
     * 应用名
     */
    name: string
    /**
     * ⚠️直接optoins进行调整
     * @param options
     * @returns
     */
    config?: (options: Options) => Options
    /**
     * 执行
     */
    useApp?: () => void
  }[]
  /**
   * 运行时配置
   */
  esbuild?: {
    [key: string]: any
    /**
     * 资源
     */
    assets?: ESBuildAsstesOptions | false
    /**
     * 样式处理
     */
    styles?: ESBuildCSSOptions | false
    /**
     * ⚠️ 直接覆盖esbuild配置
     */
    options?: SameShape<BuildOptions, BuildOptions>
  }
  /**
   * 打包时配置
   */
  build?: {
    [key: string]: any
    /**
     * 别名
     */
    alias?: RollupAliasOptions | false
    /**
     * 文件过滤
     */
    assets?: RollupAssetsOptions | false
    /**
     * 样式处理配置
     */
    styles?: RollupStylesCSSImportOptions | false
    /**
     * cjs文件处理
     */
    commonjs?: RollupCommonJSOptions | false
    /**
     * josn文件处理
     */
    json?: RollupJsonOptions | false
    /**
     * ts配置
     */
    typescript?: RollupTypescriptOptions | false
    /**
     *
     */
    plugins?: any[]
    /**
     * ⚠️ 直接覆盖build配置
     */
    rollupOptions?: {
      input?: string | string[]
    } & RollupOptions
  }
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
