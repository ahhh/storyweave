// Post-build: inject a hash-based Content-Security-Policy into dist/index.html and
// verify the artifact references no remote scripts or stylesheets.
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'

const file = new URL('../dist/index.html', import.meta.url)
let html = readFileSync(file, 'utf8')

const sha = s => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
const remote = [...html.matchAll(/<script\b[^>]*\bsrc=|<link\b[^>]*rel=["']?stylesheet/gi)]
if (remote.length) {
  console.error('Build references external scripts/stylesheets — refusing to ship.')
  process.exit(1)
}
const scriptHashes = scripts.map(m => sha(m[1]))

const csp = [
  "default-src 'none'",
  `script-src ${scriptHashes.join(' ')}`,
  // ProseMirror/y-prosemirror set inline style attributes (remote cursor colours), which
  // CSP can only allow with 'unsafe-inline'. Style injection cannot execute script.
  "style-src 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // wss: Nostr signaling relays; https: optional BYOK AI providers; localhost for local models.
  "connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:*",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

if (!html.includes('<!--CSP-->')) { console.error('CSP placeholder missing'); process.exit(1) }
html = html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${csp}">`)
writeFileSync(file, html)
if (/\beval\(|new Function\(/.test(scripts.map(m => m[1]).join(''))) console.warn('⚠ bundle contains eval/new Function — review dependencies')
console.log(`dist/index.html: ${(statSync(file).size / 1024).toFixed(0)} KiB, ${scriptHashes.length} inline script(s) hashed, CSP injected`)
