// Accessible modal: traps focus, closes on Escape, restores focus on close.
import { h } from '../util/dom.js'

export function openDialog({ title, body, actions = [], onClose, wide = false, dismissable = true }) {
  const previous = document.activeElement
  const titleId = 'dlg-' + Math.random().toString(36).slice(2)
  const close = result => {
    backdrop.remove()
    document.removeEventListener('keydown', onKey, true)
    previous?.focus?.()
    onClose?.(result)
  }
  const buttons = actions.map(a => h('button', {
    class: 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''),
    type: 'button',
    onclick: async () => { const r = await a.onClick?.(); if (r !== false) close(a.value ?? r) },
  }, a.label))
  const panel = h('div.dialog' + (wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('h2', { id: titleId }, title),
    h('div.dialog-body', body),
    buttons.length ? h('div.dialog-actions', buttons) : null,
    dismissable ? h('button.icon-btn.dialog-x', { type: 'button', 'aria-label': 'Close', onclick: () => close() }, '×') : null,
  )
  const backdrop = h('div.backdrop', { onmousedown: e => { if (dismissable && e.target === backdrop) close() } }, panel)
  const focusables = () => [...panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.offsetParent !== null)
  const onKey = e => {
    if (e.key === 'Escape' && dismissable) { e.preventDefault(); close() }
    if (e.key === 'Tab') {
      const f = focusables()
      if (!f.length) return
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
    }
  }
  document.addEventListener('keydown', onKey, true)
  document.body.append(backdrop)
  requestAnimationFrame(() => (panel.querySelector('[autofocus]') || focusables()[0])?.focus())
  return { close, panel }
}

export function confirmDialog(title, message, { confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise(resolve => {
    openDialog({
      title,
      body: h('p', message),
      actions: [
        { label: 'Cancel', value: false },
        { label: confirmLabel, primary: !danger, danger, value: true },
      ],
      onClose: v => resolve(!!v),
    })
  })
}
