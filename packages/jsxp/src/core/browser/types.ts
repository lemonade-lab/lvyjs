import type { RenderOptions, BrowserEngine } from '../../types.js'

export interface BrowserRenderer {
  start(): Promise<boolean>
  isStart(): Promise<boolean>
  render(html: string, options?: RenderOptions): Promise<Buffer | null>
  close(): Promise<void>
  getEngine(): BrowserEngine
}
