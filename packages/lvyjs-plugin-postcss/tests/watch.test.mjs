import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SourceWatcher } from '../lib/watch.js'
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function waitFor(check) {
  const deadline = Date.now() + 3000
  while (!check() && Date.now() < deadline) await pause(25)
  assert.ok(check(), 'expected filesystem change to request restart')
}
test('scanned files can be deleted and recreated without losing directory coverage', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'lvy-watch-'))
  const file = join(cwd, 'view.html')
  let restarts = 0
  const watcher = new SourceWatcher(
    { cwd, restart: () => restarts++, addWatchFile() {} },
    [],
    10,
    message => {
      throw new Error(message)
    }
  )
  try {
    await writeFile(file, 'underline')
    await watcher.update('entry', {
      files: new Set([file]),
      globs: [{ base: cwd, pattern: '**/*.html' }]
    })
    await rm(file)
    await waitFor(() => restarts >= 1)
    await watcher.update('entry', {
      files: new Set(),
      globs: [{ base: cwd, pattern: '**/*.html' }]
    })
    const previous = restarts
    await writeFile(file, 'italic')
    await waitFor(() => restarts > previous)
  } finally {
    await watcher.close()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('changing from explicit dependencies to directory coverage keeps file edits observable', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'lvy-watch-'))
  const file = join(cwd, 'view.html')
  let restarts = 0
  const watcher = new SourceWatcher(
    { cwd, restart: () => restarts++, addWatchFile() {} },
    [],
    10,
    message => {
      throw new Error(message)
    }
  )
  try {
    await writeFile(file, 'underline')
    await watcher.watchFiles('entry', [file])
    await watcher.update('entry', {
      files: new Set([file]),
      globs: [{ base: cwd, pattern: '**/*.html' }]
    })
    await writeFile(file, 'italic')
    await waitFor(() => restarts >= 1)
    await watcher.update('entry', { files: new Set([file]), globs: [] })
    const previous = restarts
    await writeFile(file, 'font-bold')
    await waitFor(() => restarts > previous)
  } finally {
    await watcher.close()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('explicit node_modules dependencies stay watched alongside a project directory scan', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'lvy-watch-'))
  let restarts = 0
  const directory = join(cwd, 'node_modules', 'fixture')
  const file = join(directory, 'style.css')
  const watcher = new SourceWatcher(
    { cwd, restart: () => restarts++, addWatchFile() {} },
    [],
    10,
    message => {
      throw new Error(message)
    }
  )
  try {
    await mkdir(directory, { recursive: true })
    await writeFile(file, 'body {color:red}')
    await watcher.update('entry', {
      files: new Set([file]),
      globs: [{ base: cwd, pattern: '**/*.html' }]
    })
    await writeFile(file, 'body {color:blue}')
    await waitFor(() => restarts >= 1)
  } finally {
    await watcher.close()
    await rm(cwd, { recursive: true, force: true })
  }
})
