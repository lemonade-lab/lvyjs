# LVY

一款为 node 构建设计的开发工具。

```sh
npm install lvyjs -D
```

- ts.config.json

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
import { alias, files } from 'lvyjs/plugins'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
export default defineConfig({
  plugins: [
    {
      name: 'my-app',
      callback: () => {
        // 要执行的会调函数
      }
    }
  ],
  build: {
    plugins: [
      alias({
        entries: [{ find: '@src', replacement: join(__dirname, 'src') }]
      }),
      files({ filter: /\.(png|jpg)$/ })
    ]
  }
})
```

```sh
npx lvy dev
```

- 装载

```ts
import { readFileSync } from 'fs'
// 得到该文件的绝对路径，类型 string
import img_logo from '../logo.png'
const data = readFileSync(img_logo, 'utf-8')
```

- 别名

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
