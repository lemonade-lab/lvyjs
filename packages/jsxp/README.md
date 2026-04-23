# jsxp

这是一个可以在 tsx 环境中,使用 puppeteer 对 tsx 组件进行截图的库

https://github.com/lemonade-lab/lvyjs

## 基本用法

```tsx
import React from 'react'
import { renderComponentIsHtmlToBuffer } from 'jsxp'
import fs from 'fs'

function App(props: { name: string }) {
  return (
    <html>
      <body>
        <div className="p-1 bg-black text-white ">hello</div>
        <div className="bg-blue-600 h-20 w-full">{props.name}</div>
      </body>
    </html>
  )
}

const img = await renderComponentIsHtmlToBuffer(App, {
  name: 'jsxp'
})

// 写入本地
img && fs.writeFileSync('./help.webp', img)
```

## 配置浏览器

> 内部自动查找默认浏览器

对于通用库场景，推荐优先使用环境变量配置浏览器路径，其次使用 .puppeteerrc 配置

```bash
export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

```js
module.exports = {
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
}
```
