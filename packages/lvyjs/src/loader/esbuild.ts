import esbuild from 'esbuild'
import { esBuildAsstes, esBuildCSS } from './plugins'

// 插件
const plugins = []

/**
 *
 */
const initPlugins = async () => {
  for (const key in global.lvyConfig.esbuild) {
    if (typeof global.lvyConfig.esbuild[key] == 'boolean') {
      continue
    }
  }
  // 如果不存在这些配置
  const keys = ['assets', 'styles']
  for (const key of keys) {
    // 如果是布尔值
    if (typeof global.lvyConfig.esbuild[key] == 'boolean') {
      continue
    }
    // 存在这些配置
    if (global.lvyConfig.esbuild[key]) {
      continue
    }
    //
    if (key == 'assets') {
      plugins.push(esBuildAsstes())
    } else if (key === 'styles') {
      plugins.push(esBuildCSS())
    }
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

  // 如果没有插件
  if (plugins.length === 0) {
    // init plugisn
    await initPlugins()
  }

  //
  const options = global.lvyConfig.esbuild?.options || {}

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
