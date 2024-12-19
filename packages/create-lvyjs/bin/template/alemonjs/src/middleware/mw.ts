/**
 * 拿到所有指定类型下的event
 */
export default OnMiddleware(
  event => {
    // 新增字段
    event['user_id'] = event.UserId
    // 常用于兼容其他框架或增强event功能

    return event
  },
  'message.create' // 监听的事件类型
)
