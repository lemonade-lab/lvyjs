import os from 'os'
import { execSync } from 'child_process'
import { existsSync, promises as fsp } from 'fs'
import path from 'path'
import type { LaunchOptions as PuppeteerLaunchOptions } from 'puppeteer-core'

/**
 * 浏览器可执行文件路径的环境变量候选列表，按优先级顺序排列
 */
const EXECUTABLE_ENV_KEYS = [
  'PUPPETEER_EXECUTABLE_PATH',
  'JSXP_EXECUTABLE_PATH',
  'GOOGLE_CHROME_BIN',
  'CHROME_BIN',
  'CHROMIUM_PATH',
  'CHROMIUM_BIN',
  'EDGE_PATH'
] as const

const RECOMMENDED_ENV_KEYS = EXECUTABLE_ENV_KEYS.slice(0, 2)

const WINDOWS_PROGRAM_FILES = [
  process.env.PROGRAMFILES,
  process.env['PROGRAMFILES(X86)'],
  process.env.ProgramW6432
].filter((value): value is string => Boolean(value))

const WINDOWS_LOCAL_APP_DATA = process.env.LOCALAPPDATA
const DARWIN_APPLICATION_ROOTS = ['/Applications', path.join(os.homedir(), 'Applications')]

function uniquePaths(values: readonly string[]) {
  return [...new Set(values)]
}

const COMMAND_CANDIDATES = [
  'chromium',
  'chromium-browser',
  'chrome',
  'google-chrome',
  'google-chrome-stable',
  'google-chrome-beta',
  'google-chrome-canary',
  'microsoft-edge',
  'microsoft-edge-stable',
  'microsoft-edge-beta',
  'microsoft-edge-dev',
  'msedge',
  'msedge.exe',
  'chrome.exe',
  'brave-browser',
  'brave-browser-stable',
  'brave.exe'
]

const PLATFORM_PATH_CANDIDATES: Record<NodeJS.Platform | 'default', string[]> = {
  aix: [],
  android: uniquePaths([
    '/system/bin/chrome',
    '/system/bin/chromium',
    '/product/bin/chrome',
    '/product/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chrome',
    '/data/data/com.termux/files/usr/bin/chromium',
    '/data/data/com.termux/files/usr/bin/chromium-browser',
    '/data/data/com.termux/files/usr/bin/google-chrome'
  ]),
  darwin: uniquePaths(
    DARWIN_APPLICATION_ROOTS.flatMap(root => [
      path.join(root, 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
      path.join(root, 'Google Chrome Beta.app', 'Contents', 'MacOS', 'Google Chrome Beta'),
      path.join(root, 'Google Chrome Canary.app', 'Contents', 'MacOS', 'Google Chrome Canary'),
      path.join(root, 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
      path.join(root, 'Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge'),
      path.join(root, 'Microsoft Edge Beta.app', 'Contents', 'MacOS', 'Microsoft Edge Beta'),
      path.join(root, 'Microsoft Edge Dev.app', 'Contents', 'MacOS', 'Microsoft Edge Dev'),
      path.join(root, 'Microsoft Edge Canary.app', 'Contents', 'MacOS', 'Microsoft Edge Canary'),
      path.join(root, 'Brave Browser.app', 'Contents', 'MacOS', 'Brave Browser')
    ])
  ),
  freebsd: ['/usr/local/bin/chromium', '/usr/local/bin/chrome'],
  haiku: [],
  linux: uniquePaths([
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome-beta',
    '/usr/bin/google-chrome-canary',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
    '/usr/bin/microsoft-edge-beta',
    '/usr/bin/microsoft-edge-dev',
    '/usr/bin/brave-browser',
    '/usr/bin/brave-browser-stable',
    '/usr/local/bin/chromium',
    '/usr/local/bin/chromium-browser',
    '/usr/local/bin/google-chrome',
    '/usr/local/bin/google-chrome-stable',
    '/usr/local/bin/microsoft-edge',
    '/usr/local/bin/brave-browser',
    '/opt/google/chrome/chrome',
    '/opt/google/chrome-beta/chrome',
    '/opt/google/chrome-unstable/chrome',
    '/opt/microsoft/msedge/msedge',
    '/opt/microsoft/msedge-beta/msedge',
    '/opt/microsoft/msedge-dev/msedge',
    '/opt/brave.com/brave/brave-browser',
    '/snap/bin/chromium',
    '/snap/bin/chromium-browser',
    '/snap/bin/google-chrome',
    '/snap/bin/microsoft-edge',
    '/snap/bin/brave'
  ]),
  openbsd: ['/usr/local/bin/chromium', '/usr/local/bin/chrome'],
  sunos: [],
  win32: uniquePaths([
    ...WINDOWS_PROGRAM_FILES.flatMap(root => [
      path.win32.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.win32.join(root, 'Google', 'Chrome Beta', 'Application', 'chrome.exe'),
      path.win32.join(root, 'Google', 'Chrome SxS', 'Application', 'chrome.exe'),
      path.win32.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.win32.join(root, 'Microsoft', 'Edge Beta', 'Application', 'msedge.exe'),
      path.win32.join(root, 'Microsoft', 'Edge Dev', 'Application', 'msedge.exe'),
      path.win32.join(root, 'Microsoft', 'Edge SxS', 'Application', 'msedge.exe'),
      path.win32.join(root, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')
    ]),
    ...(WINDOWS_LOCAL_APP_DATA
      ? [
          path.win32.join(WINDOWS_LOCAL_APP_DATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.win32.join(
            WINDOWS_LOCAL_APP_DATA,
            'Google',
            'Chrome Beta',
            'Application',
            'chrome.exe'
          ),
          path.win32.join(
            WINDOWS_LOCAL_APP_DATA,
            'Google',
            'Chrome SxS',
            'Application',
            'chrome.exe'
          ),
          path.win32.join(WINDOWS_LOCAL_APP_DATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          path.win32.join(
            WINDOWS_LOCAL_APP_DATA,
            'Microsoft',
            'Edge Beta',
            'Application',
            'msedge.exe'
          ),
          path.win32.join(
            WINDOWS_LOCAL_APP_DATA,
            'Microsoft',
            'Edge Dev',
            'Application',
            'msedge.exe'
          ),
          path.win32.join(
            WINDOWS_LOCAL_APP_DATA,
            'Microsoft',
            'Edge SxS',
            'Application',
            'msedge.exe'
          ),
          path.win32.join(
            WINDOWS_LOCAL_APP_DATA,
            'BraveSoftware',
            'Brave-Browser',
            'Application',
            'brave.exe'
          )
        ]
      : [])
  ]),
  cygwin: [],
  netbsd: [],
  default: uniquePaths([
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/microsoft-edge',
    '/usr/bin/brave-browser',
    '/opt/google/chrome/chrome',
    '/opt/microsoft/msedge/msedge',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ])
}

export function isExistingExecutablePath(value?: string | null): value is string {
  return Boolean(value && existsSync(value))
}

function getEnvExecutablePath(): string | null {
  for (const key of EXECUTABLE_ENV_KEYS) {
    const value = process.env[key]?.trim()
    if (isExistingExecutablePath(value)) {
      return value
    }
  }
  return null
}

function getCommandExecutablePath(): string | null {
  if (!['win32', 'linux', 'android', 'darwin'].includes(process.platform)) {
    return null
  }

  for (const item of COMMAND_CANDIDATES) {
    try {
      const lookupCommand = process.platform === 'win32' ? `where ${item}` : `command -v ${item}`
      const commandOutput = execSync(lookupCommand, {
        stdio: ['ignore', 'pipe', 'ignore']
      })
        .toString()
        .trim()

      const executablePath = commandOutput
        .split(/\r?\n/)
        .map(line => line.trim())
        .find(isExistingExecutablePath)

      if (isExistingExecutablePath(executablePath)) {
        return executablePath
      }
    } catch {}
  }

  return null
}

function getCandidateExecutablePath(): string | null {
  const candidates = [
    ...(PLATFORM_PATH_CANDIDATES[process.platform] ?? []),
    ...PLATFORM_PATH_CANDIDATES.default
  ]

  for (const item of candidates) {
    if (isExistingExecutablePath(item)) {
      return item
    }
  }

  return null
}

export function resolveExecutablePath(launch?: PuppeteerLaunchOptions): string | null {
  if (isExistingExecutablePath(launch?.executablePath)) {
    return launch.executablePath
  }

  return getEnvExecutablePath() ?? getCommandExecutablePath() ?? getCandidateExecutablePath()
}

export function getMissingBrowserError() {
  const arch = os.arch()
  const envKeys = RECOMMENDED_ENV_KEYS.join(', ')
  const archHint =
    arch === 'arm64' ? '当前架构为 arm64，请确认本机已安装可用的 Chrome、Chromium 或 Edge。' : ''

  return new Error(
    [
      '[browser] 未找到可用的浏览器可执行文件。',
      '请先安装 Google Chrome、Chromium 或 Microsoft Edge，然后优先使用以下方式配置路径：',
      `1. 设置环境变量：${envKeys}`,
      '2. 在项目中配置 .jsxprc.cjs 或 .jsxprc.mjs，提供 executablePath',
      '3. jsxp 仍会继续尝试内置探测逻辑，自动查找本机已安装的浏览器路径',
      '不推荐在业务代码里通过 new Picture(...) 或 new Puppeteer(...) 传入 executablePath 作为通用配置方式。',
      archHint
    ]
      .filter(Boolean)
      .join('\n')
  )
}

export function shouldRestartBrowser(error: unknown) {
  if (!(error instanceof Error)) return false

  const message = `${error.name}: ${error.message}`
  return /Target closed|Target page, context or browser has been closed|Browser has disconnected|Protocol error|Session closed|Connection closed/i.test(
    message
  )
}

const MIME_MAP: Record<string, string> = {
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  wav: 'audio/wav',
  webm: 'video/webm',
  ico: 'image/x-icon'
}

const TEXT_TYPES = new Set(['css', 'html', 'htm', 'svg', 'js', 'mjs'])
const CSS_URL_RE = /url\(["']?([^"')]+)["']?\)/g

function rewriteLocalUrls(content: string, fileDir: string): string {
  return content.replace(CSS_URL_RE, (match, ref: string) => {
    if (/^(https?:|data:|blob:|jsxp:|#)/i.test(ref)) return match
    const absPath = path.resolve(fileDir, ref)
    return `url(jsxp://${encodeURIComponent(absPath)})`
  })
}

export function createFileReadCache() {
  return new Map<string, Promise<Buffer>>()
}

export async function readLocalResponse(url: string, fileReadCache: Map<string, Promise<Buffer>>) {
  let localPath = decodeURIComponent(url.replace(/^jsxp:\/\//, ''))
  if (/^\/[A-Za-z]:\//.test(localPath)) localPath = localPath.slice(1)

  try {
    if (!fileReadCache.has(localPath)) {
      fileReadCache.set(localPath, fsp.readFile(localPath))
    }

    const buf = await fileReadCache.get(localPath)!
    const ext = path.extname(localPath).slice(1).toLowerCase()
    let body: Buffer | string = buf

    if (TEXT_TYPES.has(ext)) {
      body = rewriteLocalUrls(buf.toString('utf-8'), path.dirname(localPath))
    }

    return {
      status: 200,
      contentType: MIME_MAP[ext] || 'application/octet-stream',
      body
    }
  } catch {
    console.warn('[browser] local file not found:', localPath)
    fileReadCache.delete(localPath)
    return {
      status: 404,
      contentType: 'text/plain',
      body: 'Not found'
    }
  }
}

export function toBuffer(
  buff: Uint8Array | Buffer | string | void,
  encoding?: BufferEncoding
): Buffer | null {
  if (!buff) return null
  if (Buffer.isBuffer(buff)) return buff
  if (buff instanceof Uint8Array) {
    return Buffer.from(buff.buffer, buff.byteOffset, buff.byteLength)
  }
  if (typeof buff === 'string') {
    if (buff.startsWith('data:')) {
      const base64Data = buff.split(',')[1] || ''
      return Buffer.from(base64Data, 'base64')
    }
    return Buffer.from(buff, encoding)
  }
  return null
}
