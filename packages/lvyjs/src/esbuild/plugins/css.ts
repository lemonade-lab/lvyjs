import { type Plugin } from 'esbuild'
import { generateCSSModuleContent } from '../utils/content'
import { cssReg } from '../../config'

export type ESBuildCSSOptions = {
  filter?: RegExp
  configPath?: string
}

/**
 * css资源处理插件
 * @param param0
 * @returns
 */
export const esBuildCSS = (optoins?: ESBuildCSSOptions): Plugin => {
  const filter = optoins?.filter || cssReg
  // 返回插件
  return {
    name: 'css-loader',
    setup(build) {
      // 加载 CSS/SCSS 文件
      build.onLoad({ filter }, args => {
        const contents = generateCSSModuleContent(args.path)
        return {
          contents: contents,
          loader: 'js'
        }
      })
    }
  }
}
