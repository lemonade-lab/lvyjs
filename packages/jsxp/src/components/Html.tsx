import React, { PropsWithChildren } from 'react'
import { LinkStyleSheet } from './LinkStyles'
export default function Html({
  children,
  stylesheet
}: PropsWithChildren<{
  stylesheet?: string
}>) {
  return (
    <html>
      <head>{stylesheet && <LinkStyleSheet src={stylesheet} />}</head>
      <body>{children}</body>
    </html>
  )
}
