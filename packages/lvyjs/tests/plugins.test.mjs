import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createPluginContainer } from '../lib/plugin.js'

const packageDir = fileURLToPath(new URL('..', import.meta.url))
const cli = join(packageDir, 'bin/index.js')
const modules = resolve(packageDir, '../../node_modules')

function run(args, cwd) {
  const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', data => {
    output += data
    if (process.env.LVY_PLUGIN_TEST_VERBOSE) process.stdout.write(data)
  })
  child.stderr.on('data', data => {
    output += data
    if (process.env.LVY_PLUGIN_TEST_VERBOSE) process.stderr.write(data)
  })
  const done = once(child, 'exit').then(([code]) => ({ code, output }))
  function waitFor(text, start = 0) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Timed out waiting for ${text}: ${output}`))
      }, 60000)
      const check = () => {
        if (output.slice(start).includes(text)) {
          cleanup()
          resolve(output)
        }
      }
      const cleanup = () => {
        clearTimeout(timer)
        child.stdout.off('data', check)
        child.stderr.off('data', check)
      }
      child.stdout.on('data', check)
      child.stderr.on('data', check)
      check()
    })
  }
  return {
    child,
    done,
    waitFor,
    get output() {
      return output
    }
  }
}

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), 'lvy-plugins-'))
  await symlink(modules, join(cwd, 'node_modules'), 'dir')
  await mkdir(join(cwd, 'src'))
  await writeFile(join(cwd, 'package.json'), JSON.stringify({ type: 'module' }))
  await writeFile(
    join(cwd, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { target: 'ESNext', module: 'ESNext', jsx: 'react' },
      include: ['src']
    })
  )
  await writeFile(join(cwd, 'src/data.custom'), JSON.stringify({ value: 'first' }))
  await writeFile(join(cwd, 'src/style.css'), 'body { color: red; }')
  await writeFile(join(cwd, 'src/image.png'), 'image-content')
  await writeFile(
    join(cwd, 'src/index.ts'),
    `
import custom from './data.custom'
import virtual from 'virtual:fixture'
import asset from 'virtual:asset'
import image from './image.png'
import { readFileSync } from 'node:fs'
const token: string = '__TOKEN__'
if (readFileSync(asset, 'utf8') !== 'plugin-asset' || readFileSync(image, 'utf8') !== 'image-content') throw new Error('Resource import failed')
console.log('RESULT:' + JSON.stringify({ custom, virtual, token }))
if (process.env.KEEP_ALIVE) setInterval(() => {}, 1000)
`
  )
  await writeFile(
    join(cwd, 'lvy.config.ts'),
    `
import { defineConfig, definePlugin } from 'lvyjs'
import { readFileSync, appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
const privateValue = 'closure-survived'
const plugin = definePlugin({
  name: 'fixture',
  config(_config, env) {
    return { env: env.command === 'dev' ? { KEEP_ALIVE: '1' } : {} }
  },
  resolveId(source) {
    if (source === 'virtual:fixture') return '\\0virtual:fixture'
    if (source === 'virtual:asset') return '\\0virtual:asset'
  },
  load(id) {
    if (id === '\\0virtual:asset') return this.emitAsset({ name: 'plugin.txt', source: 'plugin-asset', fileName: 'assets/nested/plugin.txt' })
    if (id === '\\0virtual:fixture') return { code: 'import chokidar from \"chokidar\"; if (typeof chokidar.watch !== \"function\") throw new Error(\"virtual dependency failed\"); export default ' + JSON.stringify(privateValue), map: { version: 3, sources: ['virtual-source.js'], names: [], mappings: 'AAAA' } }
    if (!id.endsWith('.custom')) return null
    this.addWatchFile(id)
    return 'export default ' + readFileSync(id, 'utf8')
  },
  transform(code, id) {
    if (!id.endsWith('/index.ts')) return null
    if (code.includes(': string')) this.error('transform must receive JavaScript')
    return code.replace('__TOKEN__', 'normal')
  },
  configureDev() {
    appendFileSync('lifecycle.txt', 'open\\n')
    return () => appendFileSync('lifecycle.txt', 'cleanup\\n')
  },
  closeBundle() { appendFileSync('lifecycle.txt', 'close\\n') }
})
export default defineConfig({
  plugins: [false, Promise.resolve([plugin]), {
    name: 'post', enforce: 'post', transform(code, id) {
      return id.endsWith('/index.ts') ? code.replace('normal', 'post') : null
    }
  }],
  build: { tsdown: { logLevel: 'silent' } }
})
`
  )
  return cwd
}

test('plugin ordering, command filtering, config merge and first-result hooks', async () => {
  const calls = []
  const make = (name, enforce, apply) => ({
    name,
    enforce,
    apply,
    config() {
      calls.push(name)
      return { env: { [name]: '1' } }
    },
    load() {
      return name === 'pre' ? 'export default 1' : 'export default 2'
    },
    transform(code) {
      return code + name
    }
  })
  const { config, container } = await createPluginContainer(
    {
      plugins: [
        make('post', 'post'),
        false,
        Promise.resolve([
          make('normal'),
          make('pre', 'pre'),
          make('build-only', undefined, 'build')
        ])
      ]
    },
    { command: 'dev', cwd: process.cwd() }
  )
  assert.deepEqual(calls, ['pre', 'normal', 'post'])
  assert.deepEqual(config.env, { pre: '1', normal: '1', post: '1' })
  assert.equal((await container.load('x')).code, 'export default 1')
  assert.equal((await container.transform('', 'x')).code, 'prenormalpost')
})

test('plugin failures identify the hook and plugin', async () => {
  const { container } = await createPluginContainer(
    {
      plugins: [
        {
          name: 'broken',
          load() {
            throw new Error('bad input')
          }
        }
      ]
    },
    { command: 'dev', cwd: process.cwd() }
  )
  await assert.rejects(container.load('file.custom'), /broken.*load.*bad input/)
})

test('explicit asset filenames write nested resources and reject paths outside the output', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'lvy-asset-'))
  try {
    const plugin = { name: 'assets' }
    const { container } = await createPluginContainer(
      { plugins: [plugin] },
      { cwd, command: 'dev' }
    )
    const context = container.context(plugin)
    const code = await context.emitAsset({
      name: 'data.bin',
      fileName: 'assets/nested/data.bin',
      source: new Uint8Array([1, 2, 3])
    })
    assert.ok(code.includes(join(cwd, '.lvy/assets/nested/data.bin')))
    assert.deepEqual([...(await readFile(join(cwd, '.lvy/assets/nested/data.bin')))], [1, 2, 3])
    for (const fileName of ['../data.bin', '/data.bin', 'assets/../data.bin', 'assets\\data.bin'])
      await assert.rejects(
        context.emitAsset({ name: 'data.bin', fileName, source: '' }),
        /Invalid asset filename/
      )
    await container.close()
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test(
  'the same inline closure plugin works in dev and build; dependencies restart dev and cleanup runs',
  { timeout: 180000 },
  async () => {
    const cwd = await fixture()
    let dev
    try {
      const build = run([cli, 'build'], cwd)
      const result = await build.done
      assert.equal(result.code, 0, result.output)
      const app = await run([join(cwd, 'lib/index.js')], cwd).done
      assert.equal(app.code, 0, app.output)
      assert.match(
        app.output,
        /"custom":\{"value":"first"\},"virtual":"closure-survived","token":"post"/
      )
      dev = run([cli, 'src/index.ts'], cwd)
      await dev.waitFor('"token":"post"')
      const offset = dev.output.length
      // chokidar is initialized before the entry is executed; let its initial scan finish.
      await new Promise(resolve => setTimeout(resolve, 200))
      await writeFile(join(cwd, 'src/data.custom'), JSON.stringify({ value: 'second' }))
      await dev.waitFor('"value":"second"', offset)
      const configOffset = dev.output.length
      const configPath = join(cwd, 'lvy.config.ts')
      const config = await readFile(configPath, 'utf8')
      await writeFile(configPath, config.replace('closure-survived', 'closure-updated'))
      await dev.waitFor('"virtual":"closure-updated"', configOffset)
      dev.child.kill('SIGTERM')
      await dev.done
      const lifecycle = await readFile(join(cwd, 'lifecycle.txt'), 'utf8')
      assert.match(lifecycle, /open\ncleanup\nclose/)
    } finally {
      if (dev && dev.child.exitCode === null) {
        dev.child.kill('SIGTERM')
        await dev.done
      }
      await rm(cwd, { recursive: true, force: true })
    }
  }
)

test('standalone register uses the same plugin host', { timeout: 120000 }, async () => {
  const cwd = await fixture()
  let app
  try {
    app = run(['--import', 'tsx', '--import', 'lvyjs/register', 'src/index.ts'], cwd)
    await app.waitFor('"token":"post"')
    app.child.kill('SIGTERM')
    await app.done
  } finally {
    if (app && app.child.exitCode === null) {
      app.child.kill('SIGTERM')
      await app.done
    }
    await rm(cwd, { recursive: true, force: true })
  }
})

test(
  'CLI reports configuration and build plugin failures with a nonzero exit',
  { timeout: 120000 },
  async () => {
    const cwd = await fixture()
    try {
      await writeFile(
        join(cwd, 'lvy.config.ts'),
        `export default { plugins: [{ name: 'bad-config', config() { throw new Error('invalid option') } }] }`
      )
      const dev = await run([cli, 'src/index.ts'], cwd).done
      assert.notEqual(dev.code, 0, dev.output)
      assert.match(dev.output, /bad-config.*config.*invalid option/)
      await writeFile(
        join(cwd, 'lvy.config.ts'),
        `export default { plugins: [{ name: 'bad-build', transform() { throw new Error('invalid source') } }] }`
      )
      const build = await run([cli, 'build'], cwd).done
      assert.notEqual(build.code, 0, build.output)
      assert.match(build.output, /bad-build.*transform.*invalid source/)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }
)

test('transform maps compose and cleanup is idempotent', async () => {
  let closes = 0
  const { container } = await createPluginContainer(
    {
      plugins: [
        {
          name: 'mapped',
          transform(code) {
            return {
              code,
              map: { version: 3, sources: ['intermediate.js'], names: [], mappings: 'AAAA' }
            }
          },
          closeBundle() {
            closes++
          }
        }
      ]
    },
    { command: 'dev', cwd: process.cwd() }
  )
  const result = await container.transform('export default 1', 'output.js', {
    version: 3,
    sources: ['original.ts'],
    names: [],
    mappings: 'AAAA'
  })
  assert.deepEqual(result.map.sources, ['original.ts'])
  await container.close()
  await container.close()
  assert.equal(closes, 1)
})

test('inline input maps are separated from code before plugin transforms', async () => {
  const { transpileJavascript } = await import('../lib/javascript.js')
  const map = { version: 3, sources: ['source.js'], names: [], mappings: 'AAAA' }
  const input =
    'export default 1;\n//# sourceMappingURL=data:application/json;base64,' +
    Buffer.from(JSON.stringify(map)).toString('base64')
  const output = await transpileJavascript(input, 'source.js', process.cwd())
  assert.equal(output.code.trim(), 'export default 1;')
  assert.deepEqual(output.map, map)
})
