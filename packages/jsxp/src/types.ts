import { GoToOptions, ScreenshotOptions } from 'puppeteer'
import React from 'react'

/**
 * 无头浏览器渲染函数配置参数
 */
export type RenderOptions = {
  goto?: GoToOptions
  selector?: any
  screenshot?: Readonly<ScreenshotOptions> & {
    encoding: 'base64'
  }
}

/**
 * 组件编译
 */
export type ComponentCreateOpsionType = {
  /**
   * 扩展路径
   */
  path?: string
  /**
   *生成的文件名
   */
  name?: string
  /***
   * 是否保存并返回地址
   * 默认 true
   */
  create?: boolean
  /**
   * server 模式
   */
  server?: boolean
  /**
   * 可被浏览器渲染的完整组件
   */
  component?: React.ReactNode
}

/**
 * 工程配置选项
 * @param options
 * @returns
 */
export type JSXPOptions = {
  port?: number
  path?: string
  host?: string
  prefix?: string
  statics?: string | string[]
  routes?: {
    [key: string]: {
      component?: React.ReactNode
    }
  }
}

export type ObtainProps<T> = T extends React.FC<infer P>
  ? P
  : T extends React.ComponentClass<infer P>
  ? P
  : never
