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
