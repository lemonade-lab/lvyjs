import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import valueParser from 'postcss-value-parser'
import type { PluginContext } from 'lvyjs'

export const assetName = (name: string, source: string | Uint8Array) =>
  'assets/' +
  createHash('sha256').update(source).digest('hex').slice(0, 16) +
  '-' +
  basename(name).replace(/[^\w.-]/g, '_')

// Decode CSS escapes before URI escapes; both quoted and unquoted URLs can use them.
const unescapeCss = (value: string) =>
  value.replace(/\\(?:([0-9a-f]{1,6})\s?|([^\r\n\f]))/gi, (_match, hex, char) =>
    hex
      ? String.fromCodePoint(parseInt(hex, 16) > 0x10ffff ? 0xfffd : parseInt(hex, 16) || 0xfffd)
      : char
  )

/** Tailwind rebases imported stylesheet URLs to the entry directory before this step. */
export async function rewriteUrls(
  css: string,
  entry: string,
  context: PluginContext,
  alias: (source: string) => string,
  dependency: (path: string) => Promise<void>,
  map?: string
) {
  const emitted = new Map<string, Promise<string>>()
  const result = await postcss([
    {
      postcssPlugin: 'lvy-tailwindcss-urls',
      async Once(root) {
        const declarations: Promise<void>[] = []
        root.walkDecls(declaration => {
          if (!/url\s*\(/i.test(declaration.value)) return
          const parsed = valueParser(declaration.value)
          const replacements: Promise<void>[] = []
          parsed.walk(node => {
            if (node.type !== 'function' || node.value.toLowerCase() !== 'url') return
            const values = node.nodes.filter(
              child => child.type !== 'space' && child.type !== 'comment'
            )
            if (values.length !== 1 || !['string', 'word'].includes(values[0].type)) return false
            const value = values[0]
            const url = unescapeCss(value.value)
            const boundary = url.search(/[?#]/)
            const source = boundary < 0 ? url : url.slice(0, boundary)
            const suffix = boundary < 0 ? '' : url.slice(boundary)
            const mapped = alias(source)
            if (
              !source ||
              (mapped === source &&
                /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(source) &&
                !source.startsWith('file:'))
            )
              return false
            const path = source.startsWith('file:')
              ? fileURLToPath(source)
              : resolve(dirname(entry), decodeURIComponent(mapped))
            let resource = emitted.get(path)
            if (!resource) {
              resource = (async () => {
                await dependency(path)
                const data = await readFile(path)
                const fileName = assetName(path, data)
                await context.emitAsset({ name: basename(path), source: data, fileName })
                return './' + encodeURIComponent(basename(fileName))
              })()
              emitted.set(path, resource)
            }
            replacements.push(
              resource.then(output => {
                // Quoting protects whitespace, parentheses and other URL punctuation.
                Object.assign(value, { type: 'string', quote: '"', value: output + suffix })
              })
            )
            return false
          })
          declarations.push(
            Promise.all(replacements).then(() => {
              declaration.value = parsed.toString()
            })
          )
        })
        await Promise.all(declarations)
      }
    }
  ]).process(css, {
    from: entry,
    map: map ? { prev: map, inline: false, annotation: false } : false
  })
  return { css: result.css, map: result.map?.toString() }
}
