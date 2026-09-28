import { h, download, safeFilename } from '../../util/dom.js'
import { buildExportStory } from '../../export/model.js'
import { toTxt, toMarkdown } from '../../export/text.js'
import { toDocx, DOCX_MIME } from '../../export/docx.js'
import { makeBackup, parseBackup } from '../../export/backup.js'
import { outlineToText } from '../../story-engine/catalog.js'
import { newToken, deriveRoom } from '../../collaboration/room.js'
import { seedRoom } from '../../persistence/local.js'
import { LIMITS } from '../../collaboration/doc.js'
import * as Y from 'yjs'

export function mountExport(app, el) {
  const opts = {
    authors: h('input', { type: 'checkbox' }),
    outline: h('input', { type: 'checkbox' }),
    bible: h('input', { type: 'checkbox' }),
    prompts: h('input', { type: 'checkbox' }),
    notes: h('input', { type: 'checkbox' }),
    comments: h('input', { type: 'checkbox' }),
  }
  const labels = { authors: 'Author names', outline: 'Plot outline', bible: 'Story bible', prompts: 'Prompt answers', notes: 'Scratchpad notes', comments: 'Open comments' }

  const story = () => {
    const include = Object.fromEntries(Object.entries(opts).map(([k, v]) => [k, v.checked]))
    const outline = app.outline()
    return buildExportStory(app.doc, { plotLineName: outline?.variant.name, seed: app.seed(), include, outlineText: outlineToText(outline) })
  }
  const name = () => safeFilename(app.s.title.toString() || 'story')

  const fileInput = h('input', { type: 'file', accept: '.json,.storyweave,application/json', hidden: true, onchange: onImport })

  async function onImport() {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (!file) return
    if (file.size > LIMITS.importBytes * 1.4) { app.toast('That file is too large (20 MB limit).', 'warn'); return }
    try {
      const bytes = parseBackup(await file.text())
      await openAsNewRoom(bytes)
    } catch (err) { app.toast(err.message || 'Import failed', 'warn') }
  }

  async function openAsNewRoom(bytes) {
    const token = newToken()
    const { roomId } = await deriveRoom(token)
    await seedRoom(roomId, bytes)
    location.hash = token // triggers reload into the new room
  }

  el.append(
    h('div.view-head', h('h1', 'Export'), h('p.lede', 'Take your story anywhere. Exports contain story prose by default; add workshop material if you want it.')),
    h('div.grid-2',
      h('div.card',
        h('h2', 'Download story'),
        h('fieldset.opts', h('legend', 'Also include'), Object.entries(opts).map(([k, input]) => h('label.check', input, ' ' + labels[k]))),
        h('div.row.wrap',
          h('button.btn.primary', { type: 'button', onclick: () => download(name() + '.docx', new Blob([toDocx(story())], { type: DOCX_MIME })) }, 'Word (.docx)'),
          h('button.btn', { type: 'button', onclick: () => download(name() + '.md', toMarkdown(story()), 'text/markdown;charset=utf-8') }, 'Markdown (.md)'),
          h('button.btn', { type: 'button', onclick: () => download(name() + '.txt', toTxt(story()), 'text/plain;charset=utf-8') }, 'Plain text (.txt)'),
        ),
      ),
      h('div.card',
        h('h2', 'Project backup'),
        h('p', 'A complete copy of this room — prompts, answers, plot, notes, comments, and prose — as a single file.'),
        h('div.row.wrap',
          h('button.btn.primary', { type: 'button', onclick: () => download(name() + '.storyweave.json', makeBackup(app.doc), 'application/json') }, 'Download backup'),
          h('button.btn', { type: 'button', onclick: () => fileInput.click() }, 'Import backup as new story…'),
          h('button.btn', { type: 'button', onclick: () => openAsNewRoom(Y.encodeStateAsUpdate(app.doc)) }, 'Duplicate as new story'),
        ),
        h('p.fineprint', 'Imports and duplicates open in a fresh private room with a new link, so they never overwrite anyone’s work. API keys are never included.'),
        fileInput,
      ),
    ),
  )
}
