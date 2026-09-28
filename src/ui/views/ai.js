import { h, clear, copyText } from '../../util/dom.js'
import { PROVIDERS, AI_TASKS, AI_SCOPES, SYSTEM_PROMPT, buildTaskPrompt, getSettings, setSettings, activeProvider } from '../../ai/providers.js'
import { outlineToText } from '../../story-engine/catalog.js'
import { turnState, roster } from '../../collaboration/doc.js'
import { storyPlainText } from './overview.js'
import { openDialog } from '../dialog.js'

const MAX_CONTEXT_CHARS = 120_000

export function mountAI(app, el) {
  const st = getSettings()
  const providerSel = h('select', { 'aria-label': 'Provider' }, PROVIDERS.map(p => h('option', { value: p.id, selected: p.id === st.providerId }, p.displayName)))
  const key = h('input', { type: 'password', autocomplete: 'off', spellcheck: false, value: st.apiKey, 'aria-label': 'API key' })
  const model = h('input', { type: 'text', value: st.model, 'aria-label': 'Model' })
  const baseUrl = h('input', { type: 'url', value: st.baseUrl, placeholder: 'https://… /v1  or  http://localhost:11434/v1', 'aria-label': 'Endpoint base URL' })
  const baseRow = h('label.field', h('span', 'Endpoint'), baseUrl)
  const remember = h('input', { type: 'checkbox', checked: st.remember })
  const keyHint = h('p.fineprint')
  const saveSettings = () => {
    const p = PROVIDERS.find(x => x.id === providerSel.value)
    setSettings({ providerId: providerSel.value, apiKey: key.value.trim(), model: model.value.trim(), baseUrl: baseUrl.value.trim(), remember: remember.checked })
    model.placeholder = p.defaultModel || 'model name'
    keyHint.textContent = 'Key: ' + p.keyHint
    baseRow.hidden = p.id !== 'openai-compatible'
  }
  for (const x of [providerSel, key, model, baseUrl, remember]) x.addEventListener('input', saveSettings)
  saveSettings()

  const task = h('select', { 'aria-label': 'Task' }, AI_TASKS.map(t => h('option', { value: t.id }, t.label)))
  const scope = h('select', { 'aria-label': 'Scope' }, AI_SCOPES.map(s => h('option', { value: s.id }, s.label)))
  const n = h('input', { type: 'number', min: 1, max: 10, value: 3, 'aria-label': 'Sentences' })
  const nRow = h('label.field', h('span', 'Sentences'), n)
  const instruction = h('input', { type: 'text', placeholder: 'Optional direction, e.g. “make it eerier”', 'aria-label': 'Instruction' })
  const includeNames = h('input', { type: 'checkbox' })
  task.onchange = () => { nRow.hidden = task.value !== 'continue' }
  nRow.hidden = task.value !== 'continue'

  const output = h('div.ai-output', { 'aria-live': 'polite' })
  const actions = h('div.row.wrap')
  let controller = null

  function contextFor(scopeId) {
    const ed = app.editor
    switch (scopeId) {
      case 'selection': return ed?.selectedText() || ''
      case 'paragraph': return ed?.currentParagraphText() || ''
      case 'beat': {
        const b = app.outline()?.beats[turnState(app.doc).beat]
        return b ? `${b.label}: ${b.purpose} ${b.guidance} ${b.lensNote}\nIngredients:\n${b.ingredients.map(i => '- ' + i.answer).join('\n')}` : ''
      }
      case 'outline': return outlineToText(app.outline())
      case 'story': {
        const t = storyPlainText(app.s.story).trim()
        return t.length > MAX_CONTEXT_CHARS ? t.slice(-MAX_CONTEXT_CHARS) : t
      }
      default: return ''
    }
  }

  function preview() {
    saveSettings()
    const provider = activeProvider()
    const scopeDef = AI_SCOPES.find(s => s.id === scope.value)
    let context = contextFor(scope.value)
    if (scope.value !== 'none' && !context.trim()) { app.toast(scope.value === 'selection' ? 'Select text in the Write tab first' : 'Nothing in that scope yet'); return }
    if (!includeNames.checked) {
      // Strip participant display names from the context unless explicitly included.
      for (const p of roster(app.doc)) if (p.displayName.length > 1) context = context.split(p.displayName).join('[writer]')
    }
    const prompt = buildTaskPrompt({ task: task.value, n: Number(n.value) || 3, instruction: instruction.value.trim(), context, scopeLabel: scopeDef.label })
    const chars = SYSTEM_PROMPT.length + prompt.length
    const where = provider.id === 'anthropic' ? 'api.anthropic.com' : (getSettings().baseUrl || '(no endpoint set)')
    const sample = h('pre.ai-preview')
    sample.textContent = prompt.length > 3000 ? prompt.slice(0, 3000) + `\n… (${(prompt.length - 3000).toLocaleString()} more characters)` : prompt
    openDialog({
      title: 'Send to AI?', wide: true,
      body: [
        h('dl.kv',
          h('dt', 'Provider'), h('dd', provider.displayName),
          h('dt', 'Destination'), h('dd', where),
          h('dt', 'Model'), h('dd', provider.model || '—'),
          h('dt', 'Scope'), h('dd', scopeDef.label),
          h('dt', 'Size'), h('dd', `${chars.toLocaleString()} characters · ≈${Math.ceil(chars / 4).toLocaleString()} tokens`),
          h('dt', 'Writer names'), h('dd', includeNames.checked ? 'Included' : 'Replaced with [writer]'),
        ),
        h('p.fineprint', 'This text leaves your browser and is sent to the provider above using your key. Collaborators’ words are included if they are in scope.'),
        sample,
      ],
      actions: [{ label: 'Cancel' }, { label: 'Send', primary: true, onClick: () => run(provider, prompt) }],
    })
  }

  async function run(provider, prompt) {
    controller?.abort()
    controller = new AbortController()
    clear(output).append(h('p.muted', 'Thinking…'))
    clear(actions).append(h('button.btn', { type: 'button', onclick: () => controller?.abort() }, 'Cancel'))
    try {
      const res = await provider.generate({ system: SYSTEM_PROMPT, prompt, maxOutputTokens: 2000, signal: controller.signal })
      showResult(res.text, res.model)
    } catch (err) {
      clear(actions)
      clear(output).append(h('p.error', err?.name === 'AbortError' ? 'Cancelled.' : err?.message || 'Request failed.'))
    } finally { controller = null }
  }

  function showResult(text, modelName) {
    // AI output is untrusted: rendered as plain text; inserted only on explicit action.
    const pre = h('div.ai-text')
    pre.textContent = text
    clear(output).append(h('p.muted.small', `Suggestion${modelName ? ' from ' + modelName : ''} — nothing is added to the story until you choose.`), pre)
    clear(actions).append(
      h('button.btn', { type: 'button', onclick: async () => app.toast((await copyText(text)) ? 'Copied' : 'Copy failed') }, 'Copy'),
      h('button.btn', { type: 'button', onclick: () => { const nt = app.s.notes; nt.insert(nt.length, (nt.length ? '\n\n' : '') + text); app.toast('Added to Scratchpad') } }, 'To scratchpad'),
      h('button.btn', { type: 'button', onclick: () => { const d = document.querySelector('.draft'); if (d) { d.value = text; d.dispatchEvent(new Event('input')); app.go('write'); d.focus() } } }, 'Use as my draft'),
      ...(app.readOnly ? [] : [h('button.btn.primary', { type: 'button', onclick: () => { app.go('write'); app.editor?.insertTextAtCursor(text) } }, 'Insert at cursor')]),
    )
  }

  el.append(
    h('div.view-head', h('h1', 'AI Assist'), h('p.lede', 'Optional. Bring your own key; nothing is sent until you review and confirm. Suggestions never enter the story unless you insert them.')),
    h('div.grid-2',
      h('div.card',
        h('h2', 'Provider'),
        h('label.field', h('span', 'Service'), providerSel),
        baseRow,
        h('label.field', h('span', 'API key'), key),
        keyHint,
        h('label.field', h('span', 'Model'), model),
        h('label.check', remember, ' Remember until this tab closes'),
        h('p.fineprint', 'Your key stays in this tab’s memory (or sessionStorage if you tick the box). It is never shared with collaborators, saved in the story, or included in backups.'),
      ),
      h('div.card',
        h('h2', 'Ask'),
        h('label.field', h('span', 'Task'), task),
        h('label.field', h('span', 'Scope'), scope),
        nRow,
        h('label.field', h('span', 'Instruction'), instruction),
        h('label.check', includeNames, ' Include writer names'),
        h('button.btn.primary', { type: 'button', onclick: preview }, 'Preview & send…'),
      ),
    ),
    h('div.card', h('h2', 'Result'), output, actions),
  )
}
