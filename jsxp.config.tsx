import { defineConfig } from 'jsxp'
import Help from '@src/image/help'

let count = 0

export default defineConfig({
  routes: {
    '/Help': {
      // 不再需要强制引入React
      element: Help,
      propsCall: async () => {
        count++

        return {
          name: `Help ${count}`
        }
      }
    }
  }
})
