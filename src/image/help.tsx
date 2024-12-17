import React from 'react'
import cssURL from '@src/input.css'
import { LinkStyleSheet } from 'jsxp'
export default function App() {
  return (
    <html>
      <head>
        <LinkStyleSheet src={cssURL} />
      </head>
      <body>
        <div className="p-1 bg-black text-white ">hell,asd</div>
        <div className="bg-blue-600 h-20 w-full"></div>
      </body>
    </html>
  )
}
