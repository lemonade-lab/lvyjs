import { build as transpile, type Loader } from 'esbuild'
import { dirname, extname, join, resolve } from 'node:path'
import { existsSync } from 'node:fs'

export async function transpileJavascript(code: string, id: string, cwd: string) {
  if (!/\.(?:[cm]?ts|tsx|jsx)$/.test(id)) {
    const inline = code.match(
      /\/\/[#@] sourceMappingURL=data:application\/json(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=]+)\s*$/
    )
    return {
      code: inline ? code.slice(0, inline.index) : code,
      map: inline ? JSON.parse(Buffer.from(inline[1], 'base64').toString()) : undefined
    }
  }
  const tsconfig = join(cwd, 'tsconfig.json')
  const result = await transpile({
    stdin: {
      contents: code,
      sourcefile: id,
      resolveDir: dirname(id),
      loader: extname(id)
        .slice(1)
        .replace(/^[cm]ts$/, 'ts') as Loader
    },
    absWorkingDir: cwd,
    tsconfig: existsSync(tsconfig) ? tsconfig : undefined,
    bundle: false,
    write: false,
    outdir: '.',
    format: 'esm',
    platform: 'node',
    target: 'esnext',
    sourcemap: 'external',
    logLevel: 'silent'
  })
  const js = result.outputFiles.find(file => file.path.endsWith('.js'))!
  const map = result.outputFiles.find(file => file.path.endsWith('.map'))
  const sourceMap = map ? JSON.parse(map.text) : null
  if (sourceMap)
    sourceMap.sources = sourceMap.sources.map((source: string) =>
      resolve(dirname(map!.path), source)
    )
  return { code: js.text, map: sourceMap }
}
