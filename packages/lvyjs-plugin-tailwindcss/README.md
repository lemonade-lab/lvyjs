# lvyjs-plugin-tailwindcss

在 LVY 的开发和构建流程中使用 Tailwind CSS 4。使用官方 `@tailwindcss/node` 编译器和 `@tailwindcss/oxide` 扫描器，通过 LVY 公开插件接口接入，无需配置 PostCSS。

## 安装

需要支持插件的 `lvyjs >= 0.3.0-alpha.6`、Tailwind CSS 4.3.3 或更新的 4.x，以及 Node.js 22.18+（22.x）或 24.11+。

```sh
npm install -D lvyjs lvyjs-plugin-tailwindcss tailwindcss@^4.3.3
```

本包尚未发布时，在仓库根目录运行 `yarn install`，然后在本包目录运行 `npm run build`。仓库的 workspace 会提供本包。

## 使用

```ts
// lvy.config.ts
import { defineConfig } from 'lvyjs'
import tailwindcss from 'lvyjs-plugin-tailwindcss'

export default defineConfig({
  plugins: [tailwindcss()]
})
```

```css
/* src/style.css */
@import 'tailwindcss';

@theme {
  --color-brand: #123456;
}

.card {
  @apply flex rounded-lg;
}
```

在入口中导入 CSS，得到生成的 CSS 文件的绝对路径：

```ts
import stylesheet from './style.css'
import { readFile } from 'node:fs/promises'

const css = await readFile(stylesheet, 'utf8')
// 将 css 交给页面模板、服务端响应或你的渲染器。
```

这与 LVY 的资源导入约定一致。插件不负责把样式注入浏览器；开发时检测到源文件变化会重新生成 CSS 并重启应用，不提供 Vite 的浏览器 HMR。

```sh
lvy src/index.ts  # 开发
lvy build         # 构建，默认压缩 CSS
```

支持相对路径、绝对路径、`file:` URL 和 LVY `alias.entries` 配置的 CSS 导入，也支持 CSS 内部的别名 `@import`。构建生成的 CSS 由 LVY `emitAsset` 写入资源目录，移动完整构建目录后，JavaScript 仍可定位 CSS。

## 类名扫描与更新

默认从项目根目录扫描源文件；构建输出目录和 `.lvy` 缓存目录会被排除，防止生成文件再次被扫描或触发重启。

```ts
plugins: [tailwindcss({ base: './src', exclude: ['coverage'] })]
```

使用 Tailwind 的 CSS 指令显式配置额外来源或关闭自动扫描：

```css
@import 'tailwindcss';
@source "../templates";
@source "../node_modules/my-ui";
@source inline("underline font-bold");
```

```css
@import 'tailwindcss' source(none);
@source "../templates";
```

`@source` 路径相对于声明它的 CSS 文件。开发时监听扫描目录与编译依赖：修改类名、添加和删除源文件、修改被导入的 CSS 都会触发更新。每次编译使用新的编译器和扫描器，因此删除的类名不会残留在增量候选缓存中。这个选择优先保证正确性，大项目的重编译成本需要实际测量。

类名需要完整出现在源文件中；运行时拼接出的类名应改为完整字符串或通过 `@source inline()` 注册。

## 配置

| 参数         | 默认值                    | 用途                                              |
| ------------ | ------------------------- | ------------------------------------------------- |
| `base`       | 项目根目录                | 自动扫描根目录，相对于 LVY 项目目录               |
| `include`    | `/\.css$/`                | 要处理的 CSS 入口匹配规则                         |
| `optimize`   | 开发 `false`，构建 `true` | 启用优化；也可传 `{ minify: false }` 只优化不压缩 |
| `sourcemap`  | `false`                   | 在 CSS 中嵌入 source map                          |
| `exclude`    | `[]`                      | 额外排除的目录，相对于 LVY 项目目录               |
| `watchDelay` | `100`                     | 源文件变化后的重启防抖时间，单位毫秒              |

支持普通 CSS、`@theme`、`@source`、`@apply` 和 Tailwind 官方编译器处理的 CSS 指令。无效指令会使构建失败，错误包含插件名 `lvy:tailwindcss`。

本包处理 CSS，不编译 Sass/Less，也不提供 CSS Modules。`?raw`、`?url` 等导入交给其他插件。CSS 中图片、字体等 `url()` 引用不会由本包复制到构建目录；这些资源应使用可访问的 URL 或由应用另行部署。这里的构建目录可移动保证覆盖生成 CSS 文件本身。

## 本包开发与验收

```sh
npm run typecheck
npm run build
npm test
npm pack --dry-run
```

测试使用临时项目运行真实 LVY CLI，覆盖开发更新、源文件新增与删除、CSS 依赖更新、构建 CSS 生成与目录移动、编译错误退出，以及 source(none)、内联来源和 source map。

## 类型声明与 PostCSS 共存

```ts
// src/env.d.ts
/// <reference types="lvyjs-plugin-tailwindcss/env" />
```

LVY 核心已移除内置样式处理。该插件独立提供 CSS 编译能力，不依赖 `lvyjs-plugin-postcss`。同一 CSS 入口由先匹配的插件接管，不会自动流经另一个插件；共存时明确区分入口：

```ts
plugins: [
  tailwindcss({ include: /\.tailwind\.css$/ }),
  postcss({ include: /\.postcss\.(css|scss|sass|less)$/ })
]
```

同一入口需要额外 PostCSS 步骤时，改用 `lvyjs-plugin-postcss` 加官方 `@tailwindcss/postcss` 适配器，详见 [PostCSS 插件](../lvyjs-plugin-postcss/README.md)。这条路径的扫描与缓存行为由官方适配器管理。

首次入口 CSS 编译失败后，修正该文件也可触发开发进程恢复；监听在编译开始前注册。

同时使用两个插件时，只引用 `lvyjs-plugin-postcss/env`，它已包含 CSS、Sass/SCSS/Less 声明。无需同时引用两个插件的 `env`，以免产生重复的 CSS 默认导出声明。
