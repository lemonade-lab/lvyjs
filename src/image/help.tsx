import React from 'react'
import cssURL from '@src/input.css'
export default function App(props: { name: string }) {
  return (
    <html>
      <head>
        <link rel="stylesheet" href={cssURL} />
      </head>
      <body>
        <div className="p-1 bg-black text-white ">hello</div>
        <div className="bg-blue-600 h-20 w-full">{props.name}</div>
      </body>
    </html>
  )
}
