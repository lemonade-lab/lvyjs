import React from 'react'
import { defineConfig } from 'jsxp'
import Help from '@src/image/help'
export default defineConfig({
  routes: {
    '/Help': {
      component: <Help />
    }
  }
})
