// Tiny DOM helpers. Untrusted text is only ever assigned via textContent / value;
// this module intentionally has no way to set innerHTML.

/**
 * h('div.card#x', {onclick, title, dataset, attrs}, ...children)
 * Strings become text nodes. Falsy children are skipped.
 */
export function h(tag, props, ...children) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag)
  const el = document.createElement(m[1] || 'div')
  for (const part of m[2].match(/[.#][\w-]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1))
    else el.id = part.slice(1)
  }
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    children.unshift(props)
    props = null
  }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v)
      else if (k === 'dataset') Object.assign(el.dataset, v)
      else if (k === 'class') el.className = v
      else if (k === 'text') el.textContent = v
      else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv)
      else if (k in el && k !== 'list' && k !== 'form') el[k] = v
      else el.setAttribute(k, v === true ? '' : String(v))
    }
  }
  append(el, children)
  return el
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue
    if (Array.isArray(c)) append(el, c)
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)))
  }
}

export const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el }

/**
 * Keyed list reconciliation: reuses elements by key so bound inputs survive re-renders.
 * create(item) -> element; update(el, item) patches it.
 */
export function syncList(container, items, keyOf, create, update) {
  const existing = new Map()
  for (const child of [...container.children]) if (child.dataset.key) existing.set(child.dataset.key, child)
  let prev = null
  for (const item of items) {
    const key = String(keyOf(item))
    let el = existing.get(key)
    if (el) existing.delete(key)
    else { el = create(item); el.dataset.key = key }
    update?.(el, item)
    const want = prev ? prev.nextSibling : container.firstChild
    if (el !== want) container.insertBefore(el, want)
    prev = el
  }
  for (const el of existing.values()) el.remove()
}

export function debounce(fn, ms) {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}

/** Run fn at most once per animation frame. */
export function rafThrottle(fn) {
  let queued = false
  return () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => { queued = false; fn() })
  }
}

export function download(filename, data, mime) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: filename })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

export const safeFilename = s => (String(s || 'story').replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 60) || 'story').replace(/\s+/g, '-')

/** Accept only #rgb/#rrggbb/hsl(...) numeric colors from peers; everything else falls back. */
export function safeColor(c, fallback = '#888') {
  if (typeof c !== 'string') return fallback
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c)) return c
  if (/^hsl\(\s*\d{1,3}(\.\d+)?(deg)?\s*,?\s*\d{1,3}%\s*,?\s*\d{1,3}%\s*\)$/i.test(c)) return c
  return fallback
}

/** Clamp untrusted strings (names, labels) to sane printable length. */
export function cleanLabel(s, max = 40) {
  return String(s ?? '').replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, '').trim().slice(0, max)
}
