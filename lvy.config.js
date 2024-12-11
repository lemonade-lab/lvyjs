import { defineConfig } from 'lvyjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
export default defineConfig({
  plugins: [
    {
      name: 'lvy-test-app',
      useApp: () => import('./src/index')
    }
  ],
  alias: {
    entries: [{ find: '@src', replacement: join(__dirname, 'src') }]
  },
  assets: {
    filter: /\.(png|jpg|jpeg|gif|svg|webp|ico)$/
  },
  rollupOptions: {
    format: 'cjs', // default esm
    intro: `/**  https://vlyjs.dev  **/`,
    outro: ` /**  dev end  **/ `,
    entryFileNames: '[name].js',
    chunkFileNames: '[name]-[hash].js',
    assetFileNames: '[name]-[hash][extname]'
  },
  rollupPlugins: [
    //
  ]
})
