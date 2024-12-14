import { defineConfig } from 'lvyjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createServer as useJSXP } from 'jsxp'
const __dirname = dirname(fileURLToPath(import.meta.url))
const includes = (value: string) => process.argv.includes(value)
//
const useYunzaiJS = async () => {
  const { Client, createLogin, Processor } = await import('yunzaijs')
  setTimeout(async () => {
    await createLogin()
    Client.run()
      .then(() => Processor.install(['yunzai.config.ts', 'yunzai.config.json']))
      .catch(console.error)
  }, 0)
}
export default defineConfig({
  plugins: [
    () => {
      if (includes('--yunzai')) return () => useYunzaiJS()
      if (includes('--view')) return () => useJSXP()
    }
  ],
  alias: {
    entries: [{ find: '@src', replacement: join(__dirname, 'src') }]
  }
})
