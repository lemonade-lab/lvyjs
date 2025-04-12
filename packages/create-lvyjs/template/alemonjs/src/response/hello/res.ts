import { createSelects, Text, useSend } from 'alemonjs'
export const selects = createSelects(['message.create'])
export const regular = /^(\/|#)?hello$/
export default onResponse(selects, event => {
  // 创建一个send
  const Send = useSend(event)
  // 发送消息
  Send(Text('hello Word'))
})
