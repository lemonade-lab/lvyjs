import { renderWithInterception } from 'jsxp'
import Help from './image/help'
import fs from 'fs'

const img = await renderWithInterception(Help, {})

console.log('img', img)

// 写入本地
img && fs.writeFileSync('./help.png', img)
