import React from 'react'
import Html from './Html'
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
    <Html>
      <section id="root" data-theme={theme} className="flex flex-col">
        <div className="text-blue-400 text-5xl">{data}</div>
      </section>
    </Html>
  )
}
