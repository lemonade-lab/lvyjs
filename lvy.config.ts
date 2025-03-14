import { defineConfig } from 'lvyjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const includes = (value: string) => process.argv.includes(value)
const server = () => import('./src/index')
const jsxp = () => import('jsxp').then(async res => res.createServer())
export default defineConfig({
  plugins: [
    () => {
      if (includes('--view')) return jsxp
      return server
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
