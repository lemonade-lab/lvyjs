import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, rename, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
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
async function stop(app) {
  if (app && app.child.exitCode === null) {
    app.child.kill('SIGTERM')
    await app.done
  }
}

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), 'lvy postcss '))
  await mkdir(join(cwd, 'node_modules'))
  for (const [name, target] of [
    ['lvyjs', resolve(packageDir, '../lvyjs')],
    ['lvyjs-plugin-postcss', packageDir],
    ['lvyjs-plugin-tailwindcss', resolve(packageDir, '../lvyjs-plugin-tailwindcss')],
    ['tsx', resolve(packageDir, '../../node_modules/tsx')],
    ['sass', resolve(packageDir, '../../node_modules/sass')],
    ['less', resolve(packageDir, '../../node_modules/less')],
    ['tailwindcss', fileURLToPath(new URL('..', import.meta.resolve('tailwindcss')))]
  ])
    await symlink(target, join(cwd, 'node_modules', name), 'dir')
  await mkdir(join(cwd, 'node_modules/@tailwindcss'))
  await symlink(
    resolve(packageDir, '../../node_modules/@tailwindcss/postcss'),
    join(cwd, 'node_modules/@tailwindcss/postcss'),
    'dir'
  )
  await mkdir(join(cwd, 'src'))
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
import postcss from 'lvyjs-plugin-postcss'
import { resolve } from 'node:path'
export default defineConfig({plugins:[postcss()],alias:{entries:[{find:'@src',replacement:resolve('src')}]},build:{dts:false}})`
  )
  await writeFile(
    join(cwd, 'src/style.css'),
    '@import "@src/theme.css"; body { display: flex; user-select: none; color: TOKEN; }'
  )
  await writeFile(join(cwd, 'src/theme.css'), '.theme { color: green; }')
  await writeFile(
    join(cwd, 'postcss.config.cjs'),
    `module.exports={plugins:[{postcssPlugin:'replace-token',Declaration(decl){if(decl.value==='TOKEN')decl.value='red'}}]}`
  )
  await writeFile(
    join(cwd, 'src/index.ts'),
    `import css from '@src/style.css'; console.log('READY:'+css); if(process.env.KEEP_ALIVE)setInterval(()=>{},1000)`
  )
  return cwd
}
async function buildCss(cwd) {
  const build = await run([cli, 'build'], cwd).done
  assert.equal(build.code, 0, build.output)
  const app = run([join(cwd, 'lib/index.js')], cwd)
  const css = await app.ready()
  assert.equal((await app.done).code, 0)
  return css
}

test(
  'PostCSS builds aliases/imports/configured plugins/prefixes/maps and portable resources',
  { timeout: 120000 },
  async () => {
    const cwd = await fixture()
    try {
      let config = await readFile(join(cwd, 'lvy.config.ts'), 'utf8')
      await writeFile(
        join(cwd, 'lvy.config.ts'),
        config.replace(
          'postcss()',
          'postcss({sourcemap:true,autoprefixer:{overrideBrowserslist:["Safari 8"]}})'
        )
      )
      const css = await buildCss(cwd)
      assert.ok(
        !(await readdir(join(cwd, 'lib'), { recursive: true })).some(path =>
          path.includes(basename(cwd))
        ),
        'virtual module paths must not embed the project directory'
      )
      assert.match(css, /color: red/)
      assert.match(css, /\.theme/)
      assert.match(css, /-webkit-user-select/)
      assert.match(css, /sourceMappingURL=data:/)
      await rename(join(cwd, 'lib'), join(cwd, 'moved output'))
      const app = run([join(cwd, 'moved output/index.js')], cwd)
      assert.equal(await app.ready(), css)
      assert.equal((await app.done).code, 0)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }
)

test('dev updates imported CSS and reloads CJS/ESM config', { timeout: 180000 }, async () => {
  const cwd = await fixture()
  let app
  try {
    const config = await readFile(join(cwd, 'lvy.config.ts'), 'utf8')
    await writeFile(
      join(cwd, 'lvy.config.ts'),
      config.replace('plugins:', "env:{KEEP_ALIVE:'1'},plugins:")
    )
    await writeFile(join(cwd, 'helper.cjs'), "module.exports = 'red'")
    const helperConfig =
      "module.exports={plugins:[{postcssPlugin:'replace-token',Declaration(decl){if(decl.value==='TOKEN')decl.value=require('./helper.cjs')}}]}"
    await writeFile(join(cwd, 'postcss.config.cjs'), helperConfig)
    app = run([cli, 'src/index.ts'], cwd)
    assert.match(await app.ready(), /color: red/)
    let helperOffset = app.output.length
    await writeFile(join(cwd, 'helper.cjs'), "module.exports = 'yellow'")
    assert.match(await app.ready(helperOffset), /color: yellow/)
    helperOffset = app.output.length
    await writeFile(join(cwd, 'helper.cjs'), "module.exports = 'red'")
    assert.match(await app.ready(helperOffset), /color: red/)
    let offset = app.output.length
    await writeFile(join(cwd, 'src/theme.css'), '.theme { color: blue; }')
    assert.match(await app.ready(offset), /color: blue/)
    offset = app.output.length
    const pc = `module.exports={plugins:[{postcssPlugin:'replace-token',Declaration(decl){if(decl.value==='TOKEN')decl.value='red'}}]}`
    await writeFile(join(cwd, 'postcss.config.cjs'), pc.replace("'red'", "'purple'"))
    assert.match(await app.ready(offset), /color: purple/)
    offset = app.output.length
    await rm(join(cwd, 'postcss.config.cjs'))
    await writeFile(
      join(cwd, 'postcss.config.mjs'),
      pc.replace('module.exports=', 'export default ').replace("'red'", "'orange'")
    )
    assert.match(await app.ready(offset), /color: orange/)
    offset = app.output.length
    await writeFile(
      join(cwd, 'postcss.config.mjs'),
      pc.replace('module.exports=', 'export default ').replace("'red'", "'pink'")
    )
    assert.match(await app.ready(offset), /color: pink/)
  } finally {
    await stop(app)
    await rm(cwd, { recursive: true, force: true })
  }
})

test('optional Sass and Less preprocessors retain alias imports', { timeout: 120000 }, async () => {
  const cwd = await fixture()
  try {
    await writeFile(join(cwd, 'src/_tokens.scss'), '$brand: blue;')
    await writeFile(
      join(cwd, 'src/style.scss'),
      "@use '@src/tokens'; .sass { color: tokens.$brand; }"
    )
    await writeFile(join(cwd, 'src/tokens.less'), '@brand: orange;')
    await writeFile(
      join(cwd, 'src/style.less'),
      "@import '@src/tokens.less'; .less { color: @brand; }"
    )
    await writeFile(join(cwd, 'src/style.sass'), '.indented\n  color: purple')
    await writeFile(
      join(cwd, 'src/index.ts'),
      `import a from './style.scss'; import b from './style.less'; import c from './style.sass'; import {readFileSync} from 'node:fs';console.log('READY:'+a);if(!readFileSync(b,'utf8').includes('orange')||!readFileSync(c,'utf8').includes('purple'))throw new Error('preprocessor failure')`
    )
    assert.match(await buildCss(cwd), /color: blue/)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test(
  'bad config and bare CSS imports fail instead of silently skipping processing',
  { timeout: 120000 },
  async () => {
    const cwd = await fixture()
    try {
      await writeFile(join(cwd, 'postcss.config.cjs'), "throw new Error('invalid postcss config')")
      let result = await run([cli, 'build'], cwd).done
      assert.notEqual(result.code, 0)
      assert.match(result.output, /lvy:postcss.*load/s)
      assert.match(result.output, /invalid postcss config/)
      const config = await readFile(join(cwd, 'lvy.config.ts'), 'utf8')
      await writeFile(
        join(cwd, 'lvy.config.ts'),
        config.replace('plugins:[postcss()]', 'plugins:[]')
      )
      result = await run([cli, 'build'], cwd).done
      assert.notEqual(result.code, 0)
      assert.match(result.output, /CSS file/)
      const manifest = JSON.parse(
        await readFile(resolve(packageDir, '../lvyjs/package.json'), 'utf8')
      )
      for (const dependency of ['postcss', 'postcss-import', 'postcss-url', 'autoprefixer'])
        assert.ok(!manifest.dependencies[dependency])
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }
)

test(
  'Tailwind and PostCSS independently own filtered entries in the same project',
  { timeout: 120000 },
  async () => {
    const cwd = await fixture()
    try {
      const config = await readFile(join(cwd, 'lvy.config.ts'), 'utf8')
      await writeFile(
        join(cwd, 'lvy.config.ts'),
        "import tailwindcss from 'lvyjs-plugin-tailwindcss';\n" +
          config.replace(
            'plugins:[postcss()]',
            'plugins:[tailwindcss({include:/\\.tailwind\\.css$/}),postcss({include:/style\\.css$/})]'
          )
      )
      await writeFile(
        join(cwd, 'src/app.tailwind.css'),
        '@import "tailwindcss" source(none); @source inline("underline");'
      )
      await writeFile(
        join(cwd, 'src/index.ts'),
        `import css from './style.css';import tw from './app.tailwind.css';import {readFileSync} from 'node:fs';if(!readFileSync(tw,'utf8').includes('.underline'))throw new Error('Tailwind failure');console.log('READY:'+css)`
      )
      assert.match(await buildCss(cwd), /color: red/)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }
)

test(
  'official Tailwind PostCSS adapter composes with other PostCSS steps',
  { timeout: 120000 },
  async () => {
    const cwd = await fixture()
    try {
      await writeFile(
        join(cwd, 'postcss.config.mjs'),
        `import tailwind from '@tailwindcss/postcss';export default {plugins:[tailwind(),{postcssPlugin:'after-tailwind',OnceExit(root){root.append({selector:'.after',nodes:[{prop:'color',value:'red'}]})}}]}`
      )
      await rm(join(cwd, 'postcss.config.cjs'))
      const config = await readFile(join(cwd, 'lvy.config.ts'), 'utf8')
      await writeFile(
        join(cwd, 'lvy.config.ts'),
        config.replace('postcss()', 'postcss({imports:false,urls:false,autoprefixer:false})')
      )
      await writeFile(
        join(cwd, 'src/style.css'),
        '@import "tailwindcss" source(none); @source inline("font-bold");'
      )
      const css = await buildCss(cwd)
      assert.match(css, /\.font-bold/)
      assert.match(css, /\.after/)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }
)

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
      const original = await readFile(join(cwd, 'postcss.config.cjs'), 'utf8')
      await writeFile(join(cwd, 'postcss.config.cjs'), "throw new Error('initial bad config')")
      app = run([cli, 'src/index.ts'], cwd)
      const deadline = Date.now() + 15000
      while (!app.output.includes('开发进程异常退出') && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 50))
      assert.ok(app.output.includes('开发进程异常退出'), app.output)
      const offset = app.output.length
      await writeFile(join(cwd, 'postcss.config.cjs'), original)
      assert.match(await app.ready(offset), /color: red/)
    } finally {
      await stop(app)
      await rm(cwd, { recursive: true, force: true })
    }
  }
)
