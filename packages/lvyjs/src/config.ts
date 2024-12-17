export const assetsReg = /\.(png|jpg|jpeg|gif|svg|webp|ico)$/
export const cssReg = /\.(css|scss|less|sass|less)$/
/**
 *
 * @param val
 * @returns
 */
export const createAlias = val => {
  const alias = {}
  // 遍历 entries 数组
  val.entries.forEach(entry => {
    alias[entry.find] = entry.replacement
  })
  return alias
}
