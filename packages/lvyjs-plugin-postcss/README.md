# lvyjs-plugin-postcss

LVY 的通用样式插件。通过公开 `resolveId / load / emitAsset` 接口处理 CSS、可选 Sass/SCSS/Less，并将生成 CSS 的文件绝对路径导出给应用。

## 安装与使用

```sh
npm install -D lvyjs lvyjs-plugin-postcss
```

需要 `lvyjs >= 0.3.0-alpha.6`，Node.js 22.18+（22.x）或 24.11+。未发布时先在仓库根目录运行 `yarn install`，在本包目录运行 `npm run build`，通过 workspace 使用。

```ts
// lvy.config.ts
import { defineConfig } from 'lvyjs'
import postcss from 'lvyjs-plugin-postcss'

export default defineConfig({
  plugins: [postcss()]
})
```

```ts
// src/index.ts
import stylesheet from './style.css'
import { readFile } from 'node:fs/promises'
const css = await readFile(stylesheet, 'utf8')
```

把 CSS 内容交给页面模板、服务端响应或渲染器。插件不会自动注入浏览器样式。开发中依赖变化会重新编译并重启应用；构建目录中的 CSS 由 LVY 输出，移动完整构建目录后仍可读取。

```sh
lvy src/index.ts
lvy build
```

TypeScript 的样式导入声明已经从 LVY 迁入本包：

```ts
// src/env.d.ts
/// <reference types="lvyjs-plugin-postcss/env" />
```

## PostCSS 配置

使用 `postcss-load-config` 在项目目录发现配置，支持 `postcss.config.cjs/mjs/js/ts`、`.postcssrc` 和 `package.json` 的 `postcss` 字段。配置错误或缺失的插件会导致编译失败；没有配置文件时使用默认步骤。`config` 指定搜索目录，搜索不会越过这个目录。

```js
// postcss.config.mjs
import cssnano from 'cssnano'
export default {
  plugins: [cssnano({ preset: 'default' })]
}
```

```js
// postcss.config.cjs
module.exports = {
  plugins: {
    cssnano: { preset: 'default' }
  }
}
```

额外插件需要由项目安装。也可以在 LVY 配置中传入 `postcss({ config: false, plugins: [...] })`。开发时支持修改、添加、删除配置文件，以及 PostCSS `dependency` 和 `dir-dependency` 消息声明的依赖。CJS 配置的本地辅助模块也会被监听和重新加载；ESM 辅助模块的修改建议通过重启开发命令重新加载。

默认处理顺序：预处理 Sass/Less → `postcss-import` → URL 别名替换 → autoprefixer → 配置文件插件 → `plugins` 参数中的插件。如果配置文件显式提供同名默认插件，默认实例不会重复添加，其参数和顺序由配置文件控制。

## 别名和预处理器

CSS 入口、CSS 内部 `@import`、Sass `@use` 和 Less `@import` 支持 LVY `alias.entries` 的边界匹配；普通 CSS 相对路径和包导入保留 `postcss-import` 的解析能力。

```css
@import '@src/theme.css';
@import './base.css';
```

按需安装预处理器：

```sh
npm install -D sass less
```

```scss
@use '@src/tokens';
.card {
  color: tokens.$brand;
}
```

Sass/Less 是可选 peer dependencies，纯 CSS 项目无需安装。编译依赖会参与开发监听。CSS 中 `@import` 引入预处理器文件时，会先编译再内联。

`url()` 默认只替换别名，不复制图片/字体资源。生成的 CSS 位于资源目录，相对 URL 应由应用或部署流程处理；CSS 文件本身的可移动性不包含它引用的外部资源。暂不提供 CSS Modules；`?raw/?url` 导入留给其他插件。

## 与 Tailwind 插件的关系

两个包是独立的 LVY 插件，不相互依赖。同一 CSS 入口由第一个匹配的 `load` 处理，不会因为插件排列自动组成 CSS 流水线。

- Tailwind CSS 4 专用项目使用 `lvyjs-plugin-tailwindcss`。
- 通用 PostCSS 项目使用本包。
- 两者共存时，通过互不重叠的 `include` 区分入口。

```ts
plugins: [
  tailwindcss({ include: /\.tailwind\.css$/ }),
  postcss({ include: /\.postcss\.(css|scss|sass|less)$/ })
]
```

同一个入口需要 Tailwind 加其他 PostCSS 步骤时，只启用本包，在配置中使用官方适配器：

```sh
npm install -D tailwindcss@^4.3.3 @tailwindcss/postcss@^4.3.3
```

```ts
plugins: [postcss({ imports: false, urls: false, autoprefixer: false })]
```

```js
// postcss.config.mjs
import tailwindcss from '@tailwindcss/postcss'
import cssnano from 'cssnano'
export default {
  plugins: [tailwindcss(), cssnano({ preset: 'default' })]
}
```

关闭默认步骤后，让官方 Tailwind 适配器负责导入、URL 和前缀处理，避免重复加工。类名扫描和增量缓存行为由该适配器决定；若需要本仓库“删除类名立即清除 CSS”的专用验收保证，使用独立 Tailwind 插件。

## 参数

| 参数             | 默认值                         | 说明                                                               |
| ---------------- | ------------------------------ | ------------------------------------------------------------------ |
| `include`        | `/\.(css\|scss\|sass\|less)$/` | 入口匹配规则                                                       |
| `config`         | 项目根目录                     | 配置搜索目录；`false` 关闭发现                                     |
| `plugins`        | `[]`                           | 追加 PostCSS 插件                                                  |
| `imports`        | `true`                         | 默认内联导入与别名解析                                             |
| `urls`           | `true`                         | 默认 URL 别名处理                                                  |
| `autoprefixer`   | `true`                         | `false` 关闭，也可传 autoprefixer 参数                             |
| `processOptions` | `{}`                           | 覆盖 PostCSS 处理选项；`from/to` 由入口确定                        |
| `sourcemap`      | 遵循配置                       | `true` 嵌入 map，`false` 关闭；配置开启的外部 map 也转换为内嵌 map |
| `watchDelay`     | `100`                          | 开发重启防抖毫秒数                                                 |

旧配置 `styles: { filter: ... }` 迁移为 `plugins: [postcss({ include: ... })]`，旧 `styles: false` 则不启用样式插件。LVY 核心已移除样式处理及 PostCSS 依赖。

## 验收

```sh
npm run typecheck
npm run build
npm test
npm pack --dry-run
```

测试运行真实 LVY CLI，覆盖配置与依赖更新、预处理器、别名、前缀、map、构建目录移动、错误退出、两个独立插件的入口分工，以及官方 Tailwind PostCSS 适配器的组合处理。

首次入口 CSS 或 PostCSS 配置编译失败后，修正相应文件也可触发开发进程恢复；监听在编译开始前注册。

同时使用两个插件时，只引用 `lvyjs-plugin-postcss/env`，它已包含 CSS、Sass/SCSS/Less 声明。无需同时引用两个插件的 `env`，以免产生重复的 CSS 默认导出声明。
