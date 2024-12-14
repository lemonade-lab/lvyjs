import esbuild from 'esbuild'
import { esBuildCSS } from './plugins/css'
import { esBuildAlias } from './plugins/alias'
import { esBuildAsstes } from './plugins/Asstes'

// 插件
const plugins: esbuild.Plugin[] = []

/**
 *
 */
const initPlugins = () => {
  if (typeof global.lvyConfig?.alias != 'boolean') {
    plugins.push(esBuildAlias(global.lvyConfig.alias))
  }
  if (typeof global.lvyConfig?.assets != 'boolean') {
    plugins.push(esBuildAsstes(global.lvyConfig.assets))
  }
  if (typeof global.lvyConfig?.styles != 'boolean') {
    plugins.push(esBuildCSS(global.lvyConfig?.styles ?? {}))
  }
}

/**
 *
 * @param input
 * @returns
 */
export const ESBuild = async (input: string) => {
  // 如果没有配置
  if (!global.lvyConfig) global.lvyConfig = {}
  if (!global.lvyConfig.esbuild) global.lvyConfig.esbuild = {}

  // 没有插件时，检查是否有可用插件。
  if (plugins.length === 0) {
    // init plugisn
    await initPlugins()
  }

  const options = global.lvyConfig?.esbuild?.options ?? {}
  const pl = options?.plugins ?? []

  // 构建
  const result = await esbuild.build({
    // 入口文件
    entryPoints: [input],
    //
    bundle: true,
    // 平台
    platform: 'node',
    // 输出格式
    format: 'esm',
    // 不写入文件
    write: false,
    // 忽略所有外部依赖
    external: ['*'],
    ...options,
    plugins: [...plugins, ...pl]
  })

  if (!result.outputFiles) {
    return ''
  }
  // 返回结果
  return result.outputFiles.map(file => new TextDecoder().decode(file.contents)).join('\n')
}
