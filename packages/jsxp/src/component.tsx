import { renderToString } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { ComponentCreateOpsionType } from './types.ts'

/**
 * ************
 * 组件解析
 * **********
 */
export class Component {
  //
  #dir = ''
  //
  constructor() {
    this.#dir = join(process.cwd(), 'data', 'component')
  }

  /**
   * 编译html
   * @param options
   * @returns
   */
  compile(options: ComponentCreateOpsionType) {
    const DOCTYPE = '<!DOCTYPE html>'
    const HTML = renderToString(options.component)
    const html = `${DOCTYPE}${HTML}`
    /**
     * create false
     */
    if (typeof options?.create == 'boolean' && options?.create == false) {
      // is server  启动 server 解析
      if (options.server === true) return deleteCwd(html, options?.mountStatic)
      //
      return html
    }
    /**
     * create true
     */
    const dir = join(this.#dir, options?.path ?? '')
    // mkdir
    mkdirSync(dir, { recursive: true })
    // url
    const address = join(dir, options?.name ?? 'hello.html')
    // write
    writeFileSync(address, options.server === true ? deleteCwd(html, options?.mountStatic) : html)
    // url
    return address
  }
}

/**
 *
 * @param str
 * @param mountStatic
 * @returns
 */
const deleteCwd = (str: string, mountStatic: string) => {
  if (process.platform != 'win32') {
    return str.replace(new RegExp(process.cwd().replace(/\\/g, '\\/'), 'gi'), mountStatic)
  }
  return str
    .replace(new RegExp(process.cwd().replace(/\\/g, '\\\\'), 'gi'), mountStatic)
    .replace(new RegExp(process.cwd().replace(/\\/g, '\\/'), 'gi'), mountStatic)
    .replace(new RegExp(process.cwd().replace(/\\/g, '/'), 'gi'), mountStatic)
}
