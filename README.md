# LVY

基于 tsx、esbuld、rollup 所构建的，为 nodejs 应用设计的打包工具

| Project | Status                | Description |
| ------- | --------------------- | ----------- |
| [lvyjs] | [![lvyjs-s]][lvyjs-p] | 打包工具    |

[lvyjs]: https://github.com/lemonade-lab/alemonjs/tree/main/packages/lvyjs
[lvyjs-s]: https://img.shields.io/npm/v/lvyjs.svg
[lvyjs-p]: https://www.npmjs.com/package/lvyjs

文档： https://vlyjs.dev/

- use

```sh
npm install lvyjs -D
```

- tsconfig.json

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

- lvy.config.ts

```ts
import { defineConfig } from 'lvyjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const server = () => import('./src/index')
const jsxp = () => import('jsxp').then(res => res.createServer())
export default defineConfig({
  plugins: [() => server, () => jsxp],
  alias: {
    entries: [{ find: '@src', replacement: join(__dirname, 'src') }]
  },
  assets: {
    filter: /\.(png|jpg|jpeg|gif|svg|webp|ico)$/
  },
  // styles: {
  //   filter: /\.(less|sass|scss|css)$/
  // },
  build: {
    OutputOptions: {
      intro: `/**  https://lvyjs.dev script start **/`,
      outro: ` /**  https://lvyjs.dev script end  **/ `
    }
  }
})
```

- postcss.config.cjs

> 如果使用 lvyjsOptions.styles 的话可配置

```cjs
module.exports = {
  plugins: {
    // 允许使用import导入css文件
    'postcss-import': {},
    // 允许使用嵌套语法
    'postcss-simple-vars': {},
    // nested
    'postcss-nested': {},
    // 增加浏览器前缀
    'autoprefixer': {},
    // 内联url资源
    'postcss-url': {
      url: 'inline'
    },
    // 压缩css
    'cssnano': {
      preset: 'default'
    }
  }
}
```

```sh
npx lvy dev
```

- 装载

> src/index.ts

```ts
import { readFileSync } from 'fs'
// 得到该文件的绝对路径，类型 string
import img_logo from '../logo.png'
const data = readFileSync(img_logo, 'utf-8')
```

- 别名

> src/index.ts

```ts
import { readFileSync } from 'fs'
// 得到该文件的绝对路径，类型 string
import img_logo from '@src/asstes/img/logo.png'
const data = readFileSync(img_logo, 'utf-8')
```

- 打包

> 对 src 目录打包并输出到 lib 目录

```sh
npx lvy build
```

## Community

QQ Group 806943302
