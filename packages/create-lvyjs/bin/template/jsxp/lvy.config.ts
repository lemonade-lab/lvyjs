import { defineConfig } from 'lvyjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const jsxp = () => import('jsxp').then(res => res.createServer())
const includes = (value: string) => process.argv.includes(value)
export default defineConfig({
  plugins: [
    () => {
      if (includes('--view')) return jsxp
    }
  ],
  alias: {
    entries: [{ find: '@src', replacement: join(__dirname, 'src') }]
  }
})
