import { afterEach, describe, expect, jest, test } from '@jest/globals'
import { BrowserManager } from '../packages/jsxp/src/core/browser/manager'
import { Playwright } from '../packages/jsxp/src/core/playwright/playwright'
import { Puppeteer } from '../packages/jsxp/src/core/puppeteer/puppeteer'
import * as browserCreatePictureModule from '../packages/jsxp/src/core/browser/createPicture'
import { addToQueue as browserAddToQueue } from '../packages/jsxp/src/core/browser/queue'

describe('JSXP core 目录收口', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('BrowserManager 默认优先 Playwright', () => {
    const manager = new BrowserManager()
    expect(manager.getPreferredEngine()).toBe('playwright')
    expect(manager.getEngine()).toBe('playwright')
  })

  test('BrowserManager 在 Playwright 启动失败时回退到 Puppeteer', async () => {
    jest.spyOn(Playwright.prototype, 'start').mockResolvedValue(false)
    jest.spyOn(Puppeteer.prototype, 'start').mockResolvedValue(true)

    const manager = new BrowserManager()
    await expect(manager.start()).resolves.toBe(true)
    expect(manager.getEngine()).toBe('puppeteer')
  })

  test('BrowserManager 在 preferredEngine=puppeteer 时优先尝试 Puppeteer', async () => {
    const puppeteerStart = jest.spyOn(Puppeteer.prototype, 'start').mockResolvedValue(false)
    const playwrightStart = jest.spyOn(Playwright.prototype, 'start').mockResolvedValue(true)

    const manager = new BrowserManager(undefined, 'puppeteer')
    await expect(manager.start()).resolves.toBe(true)
    expect(puppeteerStart).toHaveBeenCalledTimes(1)
    expect(playwrightStart).toHaveBeenCalledTimes(1)
    expect(manager.getEngine()).toBe('playwright')
  })

  test('queue 在普通渲染错误下不会重启浏览器', async () => {
    const picture = {
      getPreferredEngine: () => 'playwright' as const,
      screenshot: jest.fn(async () => {
        throw new Error('boom')
      })
    }
    const pictureSpy = jest
      .spyOn(browserCreatePictureModule, 'picture')
      .mockResolvedValue(picture as never)
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'info').mockImplementation(() => {})

    await expect(browserAddToQueue({ html: '<html></html>' })).rejects.toThrow('boom')
    await expect(browserAddToQueue({ html: '<html></html>' })).rejects.toThrow('boom')

    expect(pictureSpy).not.toHaveBeenCalledWith(true, undefined)
  })

  test('queue 在连续浏览器级错误后触发浏览器重启', async () => {
    const picture = {
      getPreferredEngine: () => 'playwright' as const,
      screenshot: jest.fn(async () => {
        throw new Error('Target page, context or browser has been closed')
      })
    }
    const pictureSpy = jest
      .spyOn(browserCreatePictureModule, 'picture')
      .mockResolvedValue(picture as never)
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'info').mockImplementation(() => {})

    await expect(browserAddToQueue({ html: '<html></html>' })).rejects.toThrow(
      'Target page, context or browser has been closed'
    )
    await expect(browserAddToQueue({ html: '<html></html>' })).rejects.toThrow(
      'Target page, context or browser has been closed'
    )

    expect(pictureSpy).toHaveBeenCalledWith(true, undefined)
  })
})
