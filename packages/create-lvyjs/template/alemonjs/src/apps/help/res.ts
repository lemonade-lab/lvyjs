import { Image, Text, useSend } from 'alemonjs'
import { Pictures } from '@src/image/index'
export const regular = /^(\/|#)?pic$/
export default OnResponse(
  async event => {
    // 创建一个send
    const Send = useSend(event)
    // pic
    const img = await Pictures('help', {
      data: 'AlemonJS 跨平台开发框架'
    })
    // send
    if (typeof img != 'boolean') {
      Send(Image(img))
    } else {
      Send(Text('图片加载失败'))
    }
  },
  ['message.create']
)
