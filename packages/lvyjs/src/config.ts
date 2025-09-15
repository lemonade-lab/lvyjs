export const assetsRegExp = /\.(png|jpg|jpeg|gif|svg|webp|ico)$/
export const stylesRegExp = /\.(css|scss|less|sass|less)$/
/**
 *
 * @param val
 * @returns
 */
export const createAlias = val => {
  const alias = {}
  if (!Array.isArray(val.entries)) {
    return alias
  }
  // 遍历 entries 数组
  val.entries.forEach(entry => {
    alias[entry.find] = entry.replacement
  })
  return alias
}
export const isWin32 = () => {
  return ['win32'].includes(process.platform)
}
export const convertPath = (inputPath: string) => {
  return isWin32() ? inputPath.replace(/\\/g, '/') : inputPath
}
