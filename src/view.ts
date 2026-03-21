import { renderComponentIsHtmlToBuffer } from 'jsxp'
import Help from './image/help'
import fs from 'fs'

const img = await renderComponentIsHtmlToBuffer(Help, {
  name: 'jsxp'
})

console.log('img', img)

// 写入本地
img && fs.writeFileSync('./help.webp', img)
