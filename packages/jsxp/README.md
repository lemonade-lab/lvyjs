# jsxp

一个在 tsx 环境中, 对 tsx 组件进行截图的库

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

> 内部会优先尝试 Playwright，失败时回退 Puppeteer，并自动查找默认浏览器

默认会优先走 Playwright。如果你需要临时保持 Puppeteer 优先，可以在启动参数里传入 `preferredEngine: 'puppeteer'`。

对于通用库场景，推荐优先使用环境变量配置浏览器路径，其次使用 `.jsxprc.cjs` 或 `.jsxprc.mjs`。

旧的 `.puppeteerrc.cjs` / `.puppeteerrc.mjs` 仍然兼容，但新的主配置名建议统一迁移到 `.jsxprc.*`。

```bash
export JSXP_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

```js
// .jsxprc.cjs
module.exports = {
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
}
```
