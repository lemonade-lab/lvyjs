import { defineConfig } from 'lvyjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import postcss from 'lvyjs-plugin-postcss'
import tailwindcss from 'lvyjs-plugin-tailwindcss'
const __dirname = dirname(fileURLToPath(import.meta.url))
export default defineConfig({
  plugins: [
    // PostCSS plugin for LvyJS
    postcss({
      include: /\.(scss|sass|less)$/,
      plugins: []
    }),
    // TailwindCSS plugin for LvyJS
    tailwindcss()
  ],
  alias: {
    entries: [{ find: '@src', replacement: join(__dirname, 'src') }]
  },
  watch: ['src/**/*'],
  assets: {
    filter: /\.(png|jpg|jpeg|gif|svg|webp|ico|yaml|txt|ttf)$/
  },
  build: {
    OutputOptions: {
      intro: `/**  https://lvyjs.dev script start **/`,
      outro: ` /**  https://lvyjs.dev script end  **/ `
    },
    dts: true,
    tsdown: {}
  }
})
