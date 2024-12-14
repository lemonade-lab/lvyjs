import { defineConfig } from 'lvyjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { onStart as useAlemonJS } from 'alemonjs'
import { createServer as useJSXP } from 'jsxp'
const __dirname = dirname(fileURLToPath(import.meta.url))
const includes = (value: string) => process.argv.includes(value)
export default defineConfig({
  plugins: [
    () => {
      if (includes('--app')) return () => useAlemonJS()
      if (includes('--view')) return () => useJSXP()
    }
  ],
  alias: {
    entries: [{ find: '@src', replacement: join(__dirname, 'src') }]
  }
})
