import { readFile, writeFile, readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const html = await readFile(resolve(dist, 'app.html'), 'utf8')
const scripts = [...html.matchAll(/<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/g)]
const styles = [...html.matchAll(/<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">/g)]
const jsFiles = (await readdir(resolve(dist, 'assets'))).filter(name => name.endsWith('.js'))
if (scripts.length !== 1 || styles.length !== 1 || jsFiles.length !== 1) {
  throw new Error('Expected one bundled script and stylesheet; cannot build the offline page safely.')
}
const asset = path => resolve(dist, path.replace(/^\.\//, ''))
const js = await readFile(asset(scripts[0][1]), 'utf8')
const css = await readFile(asset(styles[0][1]), 'utf8')
if (/<\/script/i.test(js) || /<\/style/i.test(css)) {
  throw new Error('The bundled assets contain a closing HTML tag and cannot be safely inlined.')
}
// The Rollup bundle has no external imports. A classic script works from file://,
// while browser module scripts loaded from local files are blocked by CORS.
const standalone = html
  .replace(scripts[0][0], '')
  .replace(/[ \t]+(?=\r?\n)/g, '')
  .replace(styles[0][0], () => `<style>${css}</style>`)
  .replace('</body>', () => `<script>${js}</script></body>`)
await Promise.all([
  writeFile(resolve(root, 'index.html'), standalone),
  writeFile(resolve(dist, 'index.html'), standalone),
])
console.log('Created self-contained index.html for local and GitHub Pages use.')
