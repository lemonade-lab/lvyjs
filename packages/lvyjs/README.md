# LVY

基于 tsx、tsdown 构建的，为 Node.js 应用设计的开发与打包工具

| Project | Status                | Description |
| ------- | --------------------- | ----------- |
| [lvyjs] | [![lvyjs-s]][lvyjs-p] | 打包工具    |

[lvyjs]: https://github.com/lemonade-lab/alemonjs/tree/main/packages/lvyjs
[lvyjs-s]: https://img.shields.io/npm/v/lvyjs.svg
[lvyjs-p]: https://www.npmjs.com/package/lvyjs

文档： https://lemonade-lab.github.io/lvyjs.dev/

## 安装

```sh
npm install lvyjs -D
```

## 快速开始

### tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@src/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "extends": "lvyjs/tsconfig.json"
}
```

### lvy.config.ts

```ts
import { defineConfig } from 'lvyjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
export default defineConfig({
  alias: {
    entries: [{ find: '@src', replacement: join(__dirname, 'src') }]
  }
})
```

### 开发

```sh
# lvy <入口文件> [其他参数]
npx lvy src/index.ts
```

### 打包

对 src 目录打包并输出到 lib 目录：

```sh
npx lvy build
```

## 配置项

### env

注入环境变量到 `process.env`：

```ts
export default defineConfig({
  env: {
    MY_VAR: 'hello'
  }
})
```

### alias

路径别名配置：

```ts
export default defineConfig({
  alias: {
    entries: [{ find: '@src', replacement: join(__dirname, 'src') }]
  }
})
```

### assets

自定义静态资源识别规则（默认识别 `.png|.jpg|.jpeg|.gif|.svg|.webp|.ico`）：

```ts
export default defineConfig({
  assets: {
    filter: /\.(png|jpg|jpeg|gif|svg|webp|ico|yaml|txt|ttf)$/
  }
})
```

### 样式插件

样式处理已迁入独立插件。旧的 `styles` 配置改为 `plugins: [postcss({ include: ... })]`，详见下方迁移说明。

### watch

监听文件/目录变化，自动重启开发进程。支持 glob 模式：

```ts
// 简写 - 字符串数组
export default defineConfig({
  watch: ['src/**/*.yaml', 'public']
})

// 完整写法 - 自定义防抖延迟
export default defineConfig({
  watch: {
    paths: ['src/**/*.{yaml,json}', 'config'],
    delay: 1000 // 防抖延迟，默认 500ms
  }
})
```

### build

打包配置（tsdown 引擎，基于 Rolldown，需要 Node.js 22.18+）：

```ts
export default defineConfig({
  build: {
    input: 'src', // 输入目录，默认 src
    dir: 'lib', // 输出目录，默认 lib
    bundleDeps: false, // 是否把依赖打包进产物，默认 false（Node.js 库默认不打包）
    dts: true, // 生成 .d.ts 声明文件（宽松模式，默认 false）
    // tsdown 专属配置（可选），在默认映射之上覆盖
    tsdown: {
      minify: false
    }
  }
})
```

- 输出到 `lib` 目录，保持源码目录结构（`unbundle` 模式）
- 默认**不**打包依赖：产物保留 `import ... from 'pkg'`，交由运行时解析；需要把依赖打进产物（如前端类应用）时设置 `build.bundleDeps: true`
- 默认**不**生成 `.d.ts` 声明文件，需要时设置 `build.dts: true`（宽松模式：能生成的生成，诊断只作警告，无法生成的文件跳过并汇总提示，构建不失败；需要 tsdown 原生严格模式时用 `build.tsdown.dts`）
- CJS/JSON 由 Rolldown 内置处理，无需额外插件
- 静态资源由 LVY 内置插件处理；样式由独立插件处理，插件在开发与构建中共享
- 别名由 tsdown 内置 `alias` 处理，产物中的导入会改写为相对路径
- `build.OutputOptions` 兼容旧配置：`input` / `dir` / `intro` / `outro` / `sourcemap`

## 静态资源

导入图片等静态资源时，返回文件的绝对路径：

```ts
import { readFileSync } from 'fs'
// 得到该文件的绝对路径，类型 string
import img_logo from '../logo.png'
const data = readFileSync(img_logo)
```

支持别名路径：

```ts
import img_logo from '@src/assets/img/logo.png'
```

## 样式插件与迁移

LVY 核心不处理 CSS、Sass 或 Less，也不读取 PostCSS 配置。使用独立插件：

```ts
import { defineConfig } from 'lvyjs'
import postcss from 'lvyjs-plugin-postcss'

export default defineConfig({ plugins: [postcss()] })
```

```sh
npm install -D lvyjs-plugin-postcss
# 使用 Sass/Less 时按需安装
npm install -D sass less
```

原有 CSS 导入约定保持：导入值是编译完成的 CSS 文件绝对路径。`postcss.config.*` 配置由 PostCSS 插件读取。旧 `styles.filter` 移到 `postcss({ include: ... })`，原 `styles: false` 改为不启用样式插件。

Tailwind CSS 4 专用项目使用 `lvyjs-plugin-tailwindcss`。两个独立插件不自动串行处理同一入口；共存时用 `include` 区分入口。同一入口需要 Tailwind 加其他 PostCSS 步骤时，在 PostCSS 配置中使用 `@tailwindcss/postcss`。

样式类型声明也迁入插件，在项目 `env.d.ts` 中添加：

```ts
/// <reference types="lvyjs-plugin-postcss/env" />
// Tailwind 专用项目使用 lvyjs-plugin-tailwindcss/env
```

完整用法：[PostCSS 插件](../lvyjs-plugin-postcss/README.md)、[Tailwind 插件](../lvyjs-plugin-tailwindcss/README.md)。

## LVY 插件

顶层 `plugins` 同时支持开发和构建。插件可以直接写在配置里，也可以从 npm 包导入；支持异步插件、嵌套数组和 `false` 条件禁用。

```ts
import { defineConfig, definePlugin } from 'lvyjs'
import { readFile } from 'node:fs/promises'

const dataPlugin = definePlugin({
  name: 'project-data',
  resolveId(source) {
    if (source === 'virtual:version') return '\0virtual:version'
  },
  async load(id) {
    if (id === '\0virtual:version') {
      return 'export default "1.0.0"'
    }
    if (!id.endsWith('.data')) return null
    this.addWatchFile(id)
    const data = JSON.parse(await readFile(id, 'utf8'))
    return { code: `export default ${JSON.stringify(data)}`, map: null }
  }
})

export default defineConfig({ plugins: [dataPlugin] })
```

应用中可以导入 `virtual:version` 和 `./example.data`。自定义扩展名和虚拟模块的 TypeScript 类型声明由插件或项目提供。

| 接口                          | 行为                                                 |
| ----------------------------- | ---------------------------------------------------- |
| `name`                        | 必填；用于错误定位                                   |
| `enforce`                     | `pre` / 默认 / `post`                                |
| `apply`                       | `dev` / `build`；省略时两者都启用                    |
| `config(config, env)`         | 返回配置补丁；对象递归合并，数组替换，不接受新增插件 |
| `configResolved(config, env)` | 获取最终配置                                         |
| `resolveId(source, importer)` | 返回 ID、`{ id, external? }` 或 `null`               |
| `load(id)`                    | 返回 JavaScript 字符串、`{ code, map? }` 或 `null`   |
| `transform(code, id)`         | 接收转译后的 JavaScript；返回转换结果或 `null`       |
| `configureDev(context)`       | 仅开发时调用，可返回异步清理函数                     |
| `closeBundle()`               | 构建结束、配置重载或开发宿主关闭时清理资源           |

`env` 包含 `command: 'dev' | 'build'` 和 `cwd`。插件列表先展开、按命令过滤，再按执行顺序排列。`resolveId` 和 `load` 采用首个非空结果；`transform` 串行传递代码。用户 `pre` 插件先于内置资源/样式处理，默认和 `post` 插件在其后。

模块钩子的 `this` 提供 `command`、`cwd`、`addWatchFile(path)`、`warn(message)`、`error(message)` 和 `emitAsset({ name, source, fileName? })`。`addWatchFile` 在开发时登记应用重启依赖，在构建时交给构建引擎。`source` 支持字符串和 `Uint8Array`。可选的 `fileName` 指定输出目录内的相对文件名（例如 `assets/icon.png`），供资源之间建立引用；开发时对应 `.lvy/assets/icon.png`。路径不能包含 `..` 或使用绝对路径。

`emitAsset` 返回导出资源绝对路径的 **JavaScript 模块代码**，可以直接作为 `load` 的返回值：

```ts
load(id) {
  if (id !== '\0virtual:settings-file') return null
  return this.emitAsset({ name: 'settings.json', source: '{"enabled":true}' })
}
```

开发资源写入项目 `.lvy/assets` 缓存，构建资源写入输出目录。样式插件编译完成并写入文件后才返回路径；插件注册的依赖变化会重启应用。

`configureDev` 的上下文提供 `cwd`、`addWatchFile(path)` 和 `restart()`。宿主在配置重载时先执行上一轮清理函数，再建立新的插件实例。钩子运行在独立宿主中，与应用没有共享全局变量；内联插件函数和闭包不会经过 JSON 序列化。

开发与构建都支持虚拟模块；建议公开 ID 使用 `virtual:`，内部 ID 使用 `\0` 前缀。真实文件请返回绝对路径。`transform` 默认跳过开发运行时的 JSON、CommonJS 和 `node_modules` 模块；构建仍保留引擎的原生模块处理。返回转换映射时，映射应对应传入代码；无映射的转换会丢弃已有映射，避免错误定位误导。

底层构建插件仍通过 `build.tsdown.plugins` 配置。这套接口支持本文列出的 LVY 钩子，不承诺完整兼容 Vite 插件、浏览器 HMR 或 Rollup 的全部上下文方法。

插件验证：先运行 `npm run build`，再运行 `npm test`。
