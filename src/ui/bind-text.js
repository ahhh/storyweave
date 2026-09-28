// Two-way binding between a <textarea>/<input> and a Y.Text with minimal diffs,
// preserving the local caret across remote edits.
import * as Y from 'yjs'

export function bindText(el, ytext, { maxLength = 20000, readOnly = false } = {}) {
  const doc = ytext.doc
  const ORIGIN = { bind: el }
  el.value = ytext.toString()
  el.readOnly = readOnly

  const onInput = () => {
    let next = el.value
    if (next.length > maxLength) { next = next.slice(0, maxLength); el.value = next }
    const prev = ytext.toString()
    if (next === prev) return
    let start = 0
    while (start < prev.length && start < next.length && prev[start] === next[start]) start++
    let endPrev = prev.length, endNext = next.length
    while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) { endPrev--; endNext-- }
    doc.transact(() => {
      if (endPrev > start) ytext.delete(start, endPrev - start)
      if (endNext > start) ytext.insert(start, next.slice(start, endNext))
    }, ORIGIN)
  }

  const onRemote = (event, tr) => {
    if (tr.origin === ORIGIN) return
    const focused = document.activeElement === el
    let relStart, relEnd
    if (focused) {
      // compute caret positions in the *old* text, then map through the delta
      let s = el.selectionStart, e = el.selectionEnd, idx = 0
      for (const op of event.delta) {
        if (op.retain) idx += op.retain
        else if (op.insert) {
          const n = typeof op.insert === 'string' ? op.insert.length : 1
          if (idx <= s) s += n
          if (idx < e) e += n
          idx += n
        } else if (op.delete) {
          if (idx < s) s -= Math.min(op.delete, s - idx)
          if (idx < e) e -= Math.min(op.delete, e - idx)
        }
      }
      relStart = s; relEnd = e
    }
    el.value = ytext.toString()
    if (focused) el.setSelectionRange(relStart, relEnd)
    el.dispatchEvent(new Event('sw:remote'))
  }

  el.addEventListener('input', onInput)
  ytext.observe(onRemote)
  return () => { el.removeEventListener('input', onInput); ytext.unobserve(onRemote) }
}

export const isYText = t => t instanceof Y.Text
