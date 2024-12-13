import { defineConfig } from 'lvyjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const server = () => import('./src/index')
export default defineConfig({
  plugins: [
    // loader
    () => server
  ],
  alias: {
    entries: [{ find: '@src', replacement: join(__dirname, 'src') }]
  },
  assets: {
    filter: /\.(png|jpg|jpeg|gif|svg|webp|ico)$/
  },
  rollupOptions: {
    intro: `/**  https://lvyjs.dev script start **/`,
    outro: ` /**  https://lvyjs.dev script end  **/ `,
    assetFileNames: 'assets/[name]-[hash][extname]'
  }
})
