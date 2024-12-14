import { type Plugin } from 'esbuild'
import { assetsReg } from '../config'
import { generateModuleContent } from '../utils/content'

export type ESBuildAsstesOptions = {
  filter?: RegExp
}

/**
 *
 * @param param0
 */
export const esBuildAsstes = (optoins?: ESBuildAsstesOptions): Plugin => {
  // 默认配置
  const filter = optoins?.filter ?? assetsReg
  // 返回插件
  return {
    name: 'assets',
    setup(build) {
      build.onLoad({ filter }, args => {
        const content = generateModuleContent(args.path)
        return {
          contents: content,
          loader: 'js'
        }
      })
    }
  }
}
