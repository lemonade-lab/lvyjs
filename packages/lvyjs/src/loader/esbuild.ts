import esbuild from 'esbuild'
import { esBuildAlias, esBuildAsstes, esBuildCSS } from './plugins'

// 插件
const plugins = []

/**
 *
 */
const initPlugins = () => {
  if (typeof global.lvyConfig?.assets != 'boolean') {
    plugins.push(esBuildAsstes(global.lvyConfig.assets))
  }
  if (typeof global.lvyConfig?.esbuild?.styles != 'boolean') {
    plugins.push(esBuildCSS(global.lvyConfig.esbuild.styles))
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

  // alias
  if (global.lvyConfig.alias) esBuildAlias(global.lvyConfig.alias)

  // 没有插件时，检查是否有可用插件。
  if (plugins.length === 0) {
    // init plugisn
    await initPlugins()
  }

  //
  const options = global.lvyConfig?.esBuildOptions || {}

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
    plugins,
    // 忽略所有外部依赖
    external: ['*'],
    ...options
  })

  // 返回结果
  return result.outputFiles.map(file => new TextDecoder().decode(file.contents)).join('\n')
}
