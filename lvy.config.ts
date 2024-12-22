import { defineConfig } from 'lvyjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const server = () => import('./src/index')
const includes = (value: string) => process.argv.includes(value)
const jsxp = () => import('jsxp').then(async res => res.createServer())
export default defineConfig({
  plugins: [
    () => {
      if (includes('--app')) return server
      if (includes('--view')) return jsxp
    }
  ],
  alias: {
    entries: [{ find: '@src', replacement: join(__dirname, 'src') }]
  },
  build: {
    OutputOptions: {
      intro: `/**  https://lvyjs.dev script start **/`,
      outro: ` /**  https://lvyjs.dev script end  **/ `
    }
  }
})
