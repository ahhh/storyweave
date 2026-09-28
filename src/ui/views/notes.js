import { h } from '../../util/dom.js'
import { bindText } from '../bind-text.js'

export function mountNotes(app, el) {
  const area = h('textarea.notes', { placeholder: 'Cut lines, unused ideas, alternate scenes, unresolved questions… Everyone can edit this.', 'aria-label': 'Shared scratchpad' })
  bindText(area, app.s.notes, { maxLength: 200000, readOnly: app.readOnly })
  el.append(
    h('div.view-head', h('h1', 'Scratchpad'), h('p.lede', 'A shared parking lot. Nothing here appears in exports unless you choose to include notes.')),
    area,
  )
}
