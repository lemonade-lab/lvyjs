import { existsSync } from 'fs'
import { join } from 'path'
import { Alias } from './typing'
import { configFiles } from './config'
import {
  createPluginContainer,
  type PluginCommand,
  type PluginOption,
  type PluginContainer
} from './plugin'
import { pathToFileURL } from 'node:url'

type AliasOptions = {
  /**
   * 别名规则
   */
  entries?: Alias[]
}

type AssetsOptions = {
  /**
   * 过滤得到指定格式的文件识别之为静态资源
   * @example
   * filter: /\.(png|jpe?g|gif|svg|webp|ico)$/
   */
  filter?: RegExp
  /**
   * 过滤得到指定格式的文件识别之为静态资源
   * @example
   * filter: /\.(png|jpe?g|gif|svg|webp|ico)$/
   */
  include?: RegExp
}

type WatchOptions = {
  /**
   * 要监听的文件或目录路径（相对于项目根目录）
   */
  paths: string[]
  /**
   * 防抖延迟（毫秒），默认 500
   */
  delay?: number
}

type OutputOptions = {
  /**
   * 默认 src
   */
  input?: string
  /**
   * 默认 lib
   */
  dir?: string
  /**
   * 产物头部内容
   */
  intro?: string
  /**
   * 产物尾部内容
   */
  outro?: string
  /**
   * 是否生成 sourcemap，默认 false
   */
  sourcemap?: boolean
}

type BuildOptions = {
  /**
   * 输入目录，默认 src
   */
  input?: string
  /**
   * 输出目录，默认 lib
   */
  dir?: string
  /**
   * 是否把依赖打包进产物，默认 false。
   * Node.js 库默认不打包依赖（产物保留 `import ... from 'pkg'`），
   * 前端类应用可设为 true。
   */
  bundleDeps?: boolean
  /**
   * 生成 .d.ts 声明文件（宽松模式），默认 false。
   * true 或 'loose' 时生成：能生成的生成，诊断只作警告，
   * 无法生成（如推断类型引用依赖内部路径）的文件跳过并汇总提示，构建不失败。
   * 需要 tsdown 原生严格模式（诊断即失败）时使用 build.tsdown.dts。
   */
  dts?: boolean | 'loose'
  /**
   * tsdown 专属配置，在默认映射之上透传覆盖
   */
  tsdown?: Record<string, any> | false
  /**
   * 兼容旧配置：input/dir/intro/outro/sourcemap
   * （旧版本配置的 OutputOptions 别名，仅保留 lvyjs 映射的字段）
   */
  OutputOptions?: OutputOptions
}

export type Options = {
  /** Shared development and build plugins. */
  plugins?: PluginOption[]
  env?: Record<string, string | undefined>
  /**
   * 别名
   */
  alias?: AliasOptions | false
  /**
   * 静态资源识别
   */
  assets?: AssetsOptions | false
  /**
   * 监听文件/目录变化，自动重启开发进程
   * @example
   * watch: ['src/config.yaml', 'public']
   * watch: { paths: ['src/config.yaml'], delay: 500 }
   */
  watch?: string[] | WatchOptions | false
  /**
   * 打包时配置
   */
  build?: BuildOptions | false
}

/**
 *
 */
let pluginContainer: PluginContainer | undefined
export const getPluginContainer = () => pluginContainer

export const initConfig = async (command: PluginCommand = 'build') => {
  const file = configFiles.find(file => existsSync(file))
  const raw = file
    ? ((await import(pathToFileURL(join(process.cwd(), file)).href)).default ?? {})
    : {}
  const resolved = await createPluginContainer(raw, { command, cwd: process.cwd() })
  global.lvyConfig = resolved.config
  pluginContainer = resolved.container
  if (global.lvyConfig.env) {
    for (const [key, value] of Object.entries(global.lvyConfig.env)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = String(value)
    }
  }
  process.env.NODE_ENV ||= 'development'
}

/**
 * @returns
 */
export const getOptions = () => global.lvyConfig

/**
 * @param param0
 * @returns
 */
export const defineConfig = (options?: Options) => options
