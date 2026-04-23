import React, { ComponentType } from 'react'
import { ComponentCreateOptionsType, RenderOptions } from './types.js'
import { addToQueue } from './core/browser/queue.js'
import { Component } from './core/component.js'
import { Playwright } from './core/playwright/playwright.js'

const directPlaywright = new Playwright()

/**
 * 渲染组件为图片。
 * 默认使用 Playwright 直接渲染；传入 preferredEngine: 'puppeteer' 时走全局 queue。
 * @param ComOptions 组件选项
 * @param PupOptions 渲染选项
 */
export const render = async (
  ComOptions: ComponentCreateOptionsType,
  PupOptions?: RenderOptions
): Promise<Buffer | null> => {
  if (PupOptions?.preferredEngine === 'puppeteer') {
    return addToQueue(ComOptions, PupOptions)
  }
  const html =
    'html' in ComOptions && ComOptions.html != null
      ? ComOptions.html
      : await new Component().compile(ComOptions, 'local')
  return directPlaywright.render(html, { ...PupOptions, preferredEngine: 'playwright' })
}

/**
 * 渲染组件为图片Buffer
 * @param Component 组件
 * @param props 组件 props
 * @param PupOptions 渲染选项
 * @returns 截图Buffer或null
 */
export const renderComponentIsHtmlToBuffer = <P extends Record<string, unknown>>(
  Component: ComponentType<P>,
  props: P,
  PupOptions?: RenderOptions
) => {
  return render({ component: <Component {...props} /> }, PupOptions)
}

/**
 * 纯HTML模式渲染
 * @param htmlContent HTML内容字符串
 * @param PupOptions 渲染选项
 * @returns 截图Buffer或null
 */
export const renderHtmlToBuffer = async (
  htmlContent: string,
  PupOptions?: RenderOptions
): Promise<Buffer | null> => {
  return render({ html: htmlContent }, PupOptions)
}

/**
 * element + propsCall 模式渲染
 * propsCall 的返回值类型由 element 的 props 自动推导
 * @param element 组件类型
 * @param propsCall 获取 props 的函数
 * @param PupOptions 渲染选项
 * @returns 截图Buffer或null
 */
export const renderElement = <P extends Record<string, any>>(
  element: ComponentType<P>,
  propsCall?: () => P | Promise<P>,
  PupOptions?: RenderOptions
): Promise<Buffer | null> => {
  return render({ element, propsCall } as ComponentCreateOptionsType, PupOptions)
}
