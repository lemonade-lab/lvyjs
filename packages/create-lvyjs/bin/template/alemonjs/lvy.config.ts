import { defineConfig } from 'lvyjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { onStart as useAlemonJS } from 'alemonjs'
import { createServer as useJSXP } from 'jsxp'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
export default defineConfig({
  plugins: [
    () => {
      if (process.argv.includes('--app')) return () => useAlemonJS()
      if (process.argv.includes('--view')) return () => useJSXP()
    }
  ],
  build: {
    alias: {
      entries: [{ find: '@src', replacement: join(__dirname, 'src') }]
    }
  }
})
