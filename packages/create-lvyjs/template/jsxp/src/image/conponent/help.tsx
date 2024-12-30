import React from 'react'
import css_output from '@src/asstes/main.css'
import { LinkStyleSheet } from 'jsxp'
type Props = {
  data: string
  theme?: string
}
/**
 * @param param0
 * @returns
 */
export default function App({ data, theme }: Props) {
  return (
    <html>
      <head>
        <LinkStyleSheet src={css_output} />
      </head>
      <body>
        <section id="root" data-theme={theme} className="flex flex-col">
          <div className="text-blue-400 text-5xl">{data}</div>
        </section>
      </body>
    </html>
  )
}
