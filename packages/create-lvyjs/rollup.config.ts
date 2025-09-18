import { config, build } from '@lvyjs/build'
import { defineConfig } from 'rollup'
build('src/index.ts')
export default defineConfig(config.flat(Infinity))
