import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
  rename,
  realpath,
  readdir
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, basename, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import tailwindcss from '../lib/index.js'

const packageDir = fileURLToPath(new URL('..', import.meta.url))
const cli = resolve(packageDir, '../lvyjs/bin/index.js')
function run(args, cwd) {
  const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  const collect = data => {
    output += data
    if (process.env.LVY_TAILWIND_VERBOSE) process.stdout.write(data)
  }
  child.stdout.on('data', collect)
  child.stderr.on('data', collect)
  const done = new Promise((resolveDone, reject) => {
    child.once('error', reject)
    child.once('exit', code => resolveDone({ code, output }))
  })
  async function ready(start = 0) {
    const deadline = Date.now() + 60000
    while (Date.now() < deadline) {
      const match = output.slice(start).match(/READY:(.+)\n/)
      if (match) return readFile(match[1].trim(), 'utf8')
      if (child.exitCode !== null || output.slice(start).includes('开发进程异常退出'))
        throw new Error(output)
      await new Promise(resolveWait => setTimeout(resolveWait, 50))
    }
    throw new Error(`Timed out waiting for CSS: ${output}`)
  }
  return {
    child,
    done,
    ready,
    get output() {
      return output
    }
  }
}
async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), 'lvy tailwind '))
  await mkdir(join(cwd, 'node_modules'))
  for (const [name, target] of [
    ['lvyjs', resolve(packageDir, '../lvyjs')],
    ['lvyjs-plugin-tailwindcss', packageDir],
    ['tailwindcss', fileURLToPath(new URL('..', import.meta.resolve('tailwindcss')))],
    ['tsx', resolve(packageDir, '../../node_modules/tsx')]
  ])
    await symlink(target, join(cwd, 'node_modules', name), 'dir')
  await mkdir(join(cwd, 'src'))
  await mkdir(join(cwd, 'extra'))
  await writeFile(join(cwd, 'package.json'), JSON.stringify({ type: 'module' }))
  await writeFile(
    join(cwd, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { target: 'ESNext', module: 'ESNext', jsx: 'react' },
      include: ['src']
    })
  )
  await writeFile(
    join(cwd, 'lvy.config.ts'),
    `
import { defineConfig } from 'lvyjs'
import tailwindcss from 'lvyjs-plugin-tailwindcss'
import { resolve } from 'node:path'
export default defineConfig({
 plugins: [tailwindcss()], alias: { entries: [{ find: '@src', replacement: resolve('src') }] },
 build: { input: 'src', dir: 'lib', dts: false }
})`
  )
  await writeFile(
    join(cwd, 'src/style.css'),
    '@import "tailwindcss";\n@import "./theme.css";\n@source "../extra";\n.card { @apply flex; }\n'
  )
  await writeFile(join(cwd, 'src/theme.css'), '@theme { --color-brand: #123456; }')
  await writeFile(
    join(cwd, 'src/view.tsx'),
    'export const view = <div className="underline text-brand md:grid" />'
  )
  await writeFile(join(cwd, 'extra/template.html'), '<div class="font-bold"></div>')
  await writeFile(
    join(cwd, 'src/index.ts'),
    `import css from '@src/style.css'; console.log('READY:' + css); if (process.env.KEEP_ALIVE) setInterval(() => {}, 1000)`
  )
  return cwd
}
async function stop(app) {
  if (app && app.child.exitCode === null) {
    app.child.kill('SIGTERM')
    await app.done
  }
}

async function urlFixture() {
  const cwd = await fixture()
  await mkdir(join(cwd, 'src/nested'))
  await writeFile(join(cwd, 'src/picture (1).png'), 'picture-v1')
  await writeFile(join(cwd, 'src/nested/font.woff2'), 'font-data')
  await writeFile(
    join(cwd, 'src/nested/style.css'),
    `
@font-face { font-family: fixture; src: url('./font.woff2?#iefix'); }
.imported { background: url('@src/picture (1).png'); }
`
  )
  await writeFile(
    join(cwd, 'src/style.css'),
    `
@import 'tailwindcss';
@import './nested/style.css';
.alias { background-image: url(@src/picture%20%281%29.png?v=1#image); }
.relative { background: url('./picture (1).png'); }
.external { background: url(https://example.com/image.png); }
.public { background: url(/public/image.png); }
.data { background: url('data:image/png;base64,YWJj'); }
.fragment { filter: url(#filter); }
`
  )
  return cwd
}

async function assertResources(css, cssPath) {
  const urls = [...css.matchAll(/url\(["']?(\.\/[^"')]+)["']?\)/g)]
  assert.ok(urls.length >= 4, css)
  const contents = []
  for (const [, url] of urls) {
    const resource = resolve(dirname(cssPath), decodeURIComponent(url.split(/[?#]/)[0]))
    contents.push(await readFile(resource, 'utf8'))
  }
  assert.ok(contents.includes('font-data'))
  assert.ok(!css.includes('@src/'))
  assert.match(css, /\?v=1#image/)
  assert.match(css, /\?#iefix/)
  assert.match(css, /https:\/\/example.com\/image.png/)
  assert.match(css, /\/public\/image.png/)
  assert.match(css, /data:image\/png;base64,YWJj/)
  assert.match(css, /url\(["']?#filter/)
  return contents
}

test(
  'CSS URL assets resolve aliases/imported paths, preserve suffixes and relocate with the build',
  { timeout: 120000 },
  async () => {
    const cwd = await urlFixture()
    try {
      const build = await run([cli, 'build'], cwd).done
      assert.equal(build.code, 0, build.output)
      const app = run([join(cwd, 'lib/index.js')], cwd)
      const css = await app.ready()
      assert.equal((await app.done).code, 0)
      const cssPath = app.output.match(/READY:(.+)\n/)[1].trim()
      assert.ok((await assertResources(css, cssPath)).includes('picture-v1'))
      const moved = join(cwd, 'moved output')
      await rename(join(cwd, 'lib'), moved)
      const relocated = run([join(moved, 'index.js')], cwd)
      assert.equal(await relocated.ready(), css)
      assert.equal((await relocated.done).code, 0)
      await assertResources(css, relocated.output.match(/READY:(.+)\n/)[1].trim())
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }
)

test(
  'dev emits URL resources beside CSS and regenerates them when binary content changes',
  { timeout: 120000 },
  async () => {
    const cwd = await urlFixture()
    let app
    try {
      const config = await readFile(join(cwd, 'lvy.config.ts'), 'utf8')
      await writeFile(
        join(cwd, 'lvy.config.ts'),
        config.replace('plugins:', "env: { KEEP_ALIVE: '1' }, plugins:")
      )
      app = run([cli, 'src/index.ts'], cwd)
      const css = await app.ready()
      assert.ok(
        (await assertResources(css, app.output.match(/READY:(.+)\n/)[1].trim())).includes(
          'picture-v1'
        )
      )
      const offset = app.output.length
      await writeFile(join(cwd, 'src/picture (1).png'), 'picture-v2')
      const updated = await app.ready(offset)
      assert.notEqual(updated, css)
      const cssPath = app.output
        .slice(offset)
        .match(/READY:(.+)\n/)[1]
        .trim()
      assert.ok((await assertResources(updated, cssPath)).includes('picture-v2'))
    } finally {
      await stop(app)
      await rm(cwd, { recursive: true, force: true })
    }
  }
)

test(
  'missing local CSS URL assets fail the build instead of producing broken paths',
  { timeout: 120000 },
  async () => {
    const cwd = await fixture()
    try {
      await writeFile(join(cwd, 'src/style.css'), '.image { background: url(@src/missing.png); }')
      const build = await run([cli, 'build'], cwd).done
      assert.notEqual(build.code, 0)
      assert.match(build.output, /lvy:tailwindcss/)
      assert.match(build.output, /missing.png/)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }
)

test(
  'build uses Tailwind 4, aliases, @theme/@source/@apply and relocatable CSS',
  { timeout: 120000 },
  async () => {
    const cwd = await fixture()
    try {
      const result = await run([cli, 'build'], cwd).done
      assert.equal(result.code, 0, result.output)
      assert.ok(
        !(await readdir(join(cwd, 'lib'), { recursive: true })).some(path =>
          path.includes(basename(cwd))
        ),
        'virtual module paths must not embed the project directory'
      )
      const app = run([join(cwd, 'lib/index.js')], cwd)
      const css = await app.ready()
      assert.equal((await app.done).code, 0)
      for (const selector of ['.underline', '.text-brand', '.font-bold', '.card'])
        assert.ok(css.includes(selector), selector)
      assert.ok(css.includes('md\\:grid'))
      assert.ok(css.includes('#123456'))
      assert.ok(!css.includes('@import "tailwindcss"'))
      const moved = join(cwd, 'moved output')
      await rename(join(cwd, 'lib'), moved)
      const relocated = run([join(moved, 'index.js')], cwd)
      assert.equal(await relocated.ready(), css)
      assert.equal((await relocated.done).code, 0)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }
)

test(
  'dev regenerates CSS on class changes, file addition/deletion and imported CSS changes',
  { timeout: 180000 },
  async () => {
    const cwd = await fixture()
    let app
    try {
      const original = await readFile(join(cwd, 'lvy.config.ts'), 'utf8')
      await writeFile(
        join(cwd, 'lvy.config.ts'),
        original.replace('plugins:', "env: { KEEP_ALIVE: '1' }, plugins:")
      )
      app = run([cli, 'src/index.ts'], cwd)
      assert.ok((await app.ready()).includes('.underline'))
      let offset = app.output.length
      await writeFile(
        join(cwd, 'src/view.tsx'),
        'export const view = <div className="italic text-brand" />'
      )
      let css = await app.ready(offset)
      assert.ok(css.includes('.italic'))
      assert.ok(!css.includes('.underline'))
      offset = app.output.length
      await writeFile(join(cwd, 'extra/new.html'), '<div class="line-through"></div>')
      assert.ok((await app.ready(offset)).includes('.line-through'))
      offset = app.output.length
      await rm(join(cwd, 'extra/new.html'))
      assert.ok(!(await app.ready(offset)).includes('.line-through'))
      offset = app.output.length
      await writeFile(join(cwd, 'src/theme.css'), '@theme { --color-brand: #654321; }')
      assert.ok((await app.ready(offset)).includes('#654321'))
      offset = app.output.length
      await new Promise(resolveWait => setTimeout(resolveWait, 700))
      assert.ok(
        !app.output.slice(offset).includes('READY:'),
        'generated CSS must not restart its own watcher'
      )
    } finally {
      await stop(app)
      await rm(cwd, { recursive: true, force: true })
    }
  }
)

test(
  'invalid Tailwind CSS fails the real build with the plugin name',
  { timeout: 120000 },
  async () => {
    const cwd = await fixture()
    try {
      await writeFile(
        join(cwd, 'src/style.css'),
        '@import "tailwindcss"; .bad { @apply nonexistent-utility; }'
      )
      const result = await run([cli, 'build'], cwd).done
      assert.notEqual(result.code, 0, result.output)
      assert.match(result.output, /lvy:tailwindcss/)
      assert.match(result.output, /nonexistent-utility/)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }
)

test('source(none), inline sources, plain CSS and embedded maps use the public hooks', async () => {
  const cwd = await fixture()
  try {
    const plugin = tailwindcss({ sourcemap: true, optimize: { minify: false } })
    plugin.configResolved({}, { command: 'build', cwd })
    const file = join(cwd, 'src/style.css')
    await writeFile(
      file,
      '@import "tailwindcss" source(none); @source inline("p-4"); body { color: red; }'
    )
    const id = plugin.resolveId('./style.css', join(cwd, 'src/index.ts'))
    let emitted
    const watched = []
    const context = {
      command: 'build',
      addWatchFile: file => watched.push(file),
      emitAsset: asset => {
        emitted = asset
        return 'export default "asset.css"'
      }
    }
    assert.equal(await plugin.load.call(context, id), 'export default "asset.css"')
    assert.match(emitted.source, /\.p-4/)
    assert.ok(!emitted.source.includes('.underline'))
    assert.match(emitted.source, /sourceMappingURL=data:/)
    assert.ok(watched.includes(file))
    await writeFile(file, 'body { color: red; }')
    await plugin.load.call(context, id)
    assert.match(emitted.source, /color: red/)
    await plugin.closeBundle()
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('Tailwind plugin dependencies reload, and entry filters respect alias boundaries and file URLs', async () => {
  const cwd = await fixture()
  try {
    const plugin = tailwindcss({ include: /\.css$/g, optimize: false })
    plugin.configResolved(
      { alias: { entries: [{ find: '@src', replacement: join(cwd, 'src') }] } },
      { command: 'build', cwd }
    )
    assert.equal(plugin.resolveId('@src-other/style.css'), null)
    assert.equal(plugin.resolveId('./style.css?raw', join(cwd, 'src/index.ts')), null)
    const file = join(cwd, 'src/style.css')
    const id = plugin.resolveId('@src/style.css')
    assert.equal(plugin.resolveId(pathToFileURL(file).href), id)
    assert.equal(plugin.resolveId('@src/style.css'), id, 'global regex lastIndex must reset')
    await writeFile(
      file,
      '@import "tailwindcss" source(none); @plugin "./utility.cjs"; @source inline("plugin-probe");'
    )
    const utility = join(cwd, 'src/utility.cjs')
    await writeFile(
      utility,
      'module.exports = ({addUtilities}) => addUtilities({".plugin-probe": { color: "blue" }})'
    )
    let css
    const files = new Set()
    const context = {
      command: 'build',
      addWatchFile: path => files.add(path),
      emitAsset: asset => {
        css = asset.source
        return 'export default "asset.css"'
      }
    }
    await plugin.load.call(context, id)
    assert.match(css, /color: blue/)
    assert.ok(files.has(await realpath(utility)))
    await writeFile(
      utility,
      'module.exports = ({addUtilities}) => addUtilities({".plugin-probe": { color: "green" }})'
    )
    await plugin.load.call(context, id)
    assert.match(css, /color: green/)
    assert.ok(!css.includes('color: blue'))
    await plugin.closeBundle()
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test(
  'development recovers after correcting the first failed compilation',
  { timeout: 90000 },
  async () => {
    const cwd = await fixture()
    let app
    try {
      const config = await readFile(join(cwd, 'lvy.config.ts'), 'utf8')
      await writeFile(
        join(cwd, 'lvy.config.ts'),
        config.replace('plugins:', "env: { KEEP_ALIVE: '1' }, plugins:")
      )
      const original = await readFile(join(cwd, 'src/style.css'), 'utf8')
      await writeFile(
        join(cwd, 'src/style.css'),
        '@import "tailwindcss"; .bad { @apply nonexistent-utility; }'
      )
      app = run([cli, 'src/index.ts'], cwd)
      const deadline = Date.now() + 15000
      while (!app.output.includes('开发进程异常退出') && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 50))
      assert.ok(app.output.includes('开发进程异常退出'), app.output)
      const offset = app.output.length
      await writeFile(join(cwd, 'src/style.css'), original)
      assert.match(await app.ready(offset), /\.underline/)
    } finally {
      await stop(app)
      await rm(cwd, { recursive: true, force: true })
    }
  }
)

test(
  'alias root import followed by Tailwind expands @apply inside @layer base',
  { timeout: 120000 },
  async () => {
    const cwd = await fixture()
    try {
      await mkdir(join(cwd, 'src/assets'))
      await writeFile(join(cwd, 'src/assets/root.css'), ':root { --root-probe: 1; }')
      await writeFile(
        join(cwd, 'src/style.css'),
        `@import '@src/assets/root.css';
@import 'tailwindcss';
@layer base {
  body {
    @apply m-0 p-0 flex flex-col;
  }
}`
      )
      const build = await run([cli, 'build'], cwd).done
      assert.equal(build.code, 0, build.output)
      const app = run([join(cwd, 'lib/index.js')], cwd)
      const css = await app.ready()
      assert.equal((await app.done).code, 0, app.output)
      assert.ok(!css.includes('@apply'))
      assert.ok(!css.includes('@import'))
      assert.match(css, /--root-probe/)
      assert.match(css, /display:\s*flex/)
      assert.match(css, /flex-direction:\s*column/)
      assert.match(css, /margin:\s*0/)
      assert.match(css, /padding:\s*0/)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }
)
