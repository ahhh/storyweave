// Optional AI assistance. Bring-your-own-key only: nothing secret ships in this page.
// Keys live in memory by default, or sessionStorage if the user opts in — never in the
// shared document, IndexedDB, backups, logs, or URLs.
//
// interface TextGenerationProvider {
//   id, displayName, needsKey, defaultModel
//   configure(settings)
//   generate({ system?, prompt, maxOutputTokens?, signal? }) -> Promise<{ text, model?, usage? }>
// }

const SESSION_KEY = 'storyweave:ai'

class AnthropicProvider {
  id = 'anthropic'
  displayName = 'Claude (Anthropic API)'
  needsKey = true
  defaultModel = 'claude-opus-5'
  keyHint = 'sk-ant-…  from console.anthropic.com'

  configure({ apiKey, model }) {
    this.apiKey = apiKey
    this.model = model || this.defaultModel
    this.client = null
  }

  async generate({ system, prompt, maxOutputTokens = 2000, signal }) {
    if (!this.apiKey) throw new Error('Add an Anthropic API key first.')
    if (!this.client) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      // Browser use is intentional: the key is the user's own and never leaves their tab
      // except in requests to api.anthropic.com.
      this.client = new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })
    }
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxOutputTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      }, { signal })
      if (response.stop_reason === 'refusal') throw new Error('The model declined this request.')
      const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
      return { text, model: response.model, usage: response.usage }
    } catch (err) {
      throw friendlyError(err)
    }
  }
}

class OpenAICompatibleProvider {
  id = 'openai-compatible'
  displayName = 'OpenAI-compatible endpoint'
  needsKey = false
  defaultModel = ''
  keyHint = 'optional for local servers (Ollama, LM Studio, llama.cpp)'

  configure({ apiKey, model, baseUrl }) {
    this.apiKey = apiKey
    this.model = model
    this.baseUrl = (baseUrl || '').replace(/\/+$/, '')
  }

  async generate({ system, prompt, maxOutputTokens = 2000, signal }) {
    if (!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(this.baseUrl)) {
      throw new Error('Endpoint must be https:// (or http://localhost for a local model server).')
    }
    if (!this.model) throw new Error('Enter a model name.')
    let res
    try {
      res = await fetch(this.baseUrl + '/chat/completions', {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', ...(this.apiKey ? { authorization: 'Bearer ' + this.apiKey } : {}) },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxOutputTokens,
          messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
        }),
      })
    } catch (err) {
      if (err?.name === 'AbortError') throw err
      throw new Error('Could not reach the endpoint. It may be offline or may not allow browser (CORS) requests.')
    }
    if (!res.ok) throw new Error(`Endpoint returned ${res.status}. Check the URL, model, and key.`)
    const data = await res.json().catch(() => null)
    const text = data?.choices?.[0]?.message?.content
    if (typeof text !== 'string') throw new Error('Unexpected response from the endpoint.')
    return { text: text.trim(), model: data.model, usage: data.usage }
  }
}

function friendlyError(err) {
  if (err?.name === 'AbortError' || err?.constructor?.name === 'APIUserAbortError') {
    const e = new Error('Cancelled.'); e.name = 'AbortError'; return e
  }
  const status = err?.status
  if (status === 401) return new Error('The API key was rejected.')
  if (status === 403) return new Error('This key is not allowed to use that model.')
  if (status === 404) return new Error('Model not found. Check the model name.')
  if (status === 429) return new Error('Rate limited — wait a moment and try again.')
  if (status >= 500) return new Error('The AI service had a problem. Try again shortly.')
  if (err?.message && /fetch|network/i.test(err.message)) return new Error('Network error reaching the AI service.')
  return new Error(err?.message || 'AI request failed.')
}

export const PROVIDERS = [new AnthropicProvider(), new OpenAICompatibleProvider()]

// ---- settings (memory, optionally sessionStorage) ----
let settings = { providerId: 'anthropic', apiKey: '', model: '', baseUrl: '', remember: false }
try {
  const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
  if (saved && typeof saved === 'object') settings = { ...settings, ...saved, remember: true }
} catch {}

export const getSettings = () => ({ ...settings })

export function setSettings(next) {
  settings = { ...settings, ...next }
  try {
    if (settings.remember) sessionStorage.setItem(SESSION_KEY, JSON.stringify(settings))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {}
}

export function activeProvider() {
  const p = PROVIDERS.find(p => p.id === settings.providerId) || PROVIDERS[0]
  p.configure({ apiKey: settings.apiKey, model: settings.model || p.defaultModel, baseUrl: settings.baseUrl })
  return p
}

// ---- tasks ----
export const AI_TASKS = [
  { id: 'continue', label: 'Continue for N sentences', needsN: true },
  { id: 'rewrite', label: 'Rewrite with instruction', needsInstruction: true },
  { id: 'dialogue', label: 'Dialogue alternatives' },
  { id: 'sensory', label: 'Sensory-detail suggestions' },
  { id: 'brainstorm', label: 'Brainstorm ideas only' },
  { id: 'consistency', label: 'Consistency check' },
]

export const AI_SCOPES = [
  { id: 'selection', label: 'Selected text' },
  { id: 'paragraph', label: 'Current paragraph' },
  { id: 'beat', label: 'Current plot beat' },
  { id: 'outline', label: 'Full outline' },
  { id: 'story', label: 'Story so far' },
  { id: 'none', label: 'Nothing (brainstorm from instruction only)' },
]

export const SYSTEM_PROMPT = `You are a collaborative fiction assistant helping a small group co-write a story. Offer suggestions the human writers can adopt, adapt, or ignore. Match the existing voice and tense. Reply with plain prose only — no preamble, no markdown headings, no commentary unless the task asks for a list or a check.`

export function buildTaskPrompt({ task, n, instruction, context, scopeLabel }) {
  const ctx = context ? `${scopeLabel}:\n"""\n${context}\n"""\n\n` : ''
  switch (task) {
    case 'continue': return `${ctx}Continue the story for ${n} sentence${n === 1 ? '' : 's'}.${instruction ? ` Direction: ${instruction}` : ''}`
    case 'rewrite': return `${ctx}Rewrite the text above. Instruction: ${instruction || 'tighten and sharpen it'}.`
    case 'dialogue': return `${ctx}Offer three alternative lines of dialogue that could fit here, one per line.${instruction ? ` Note: ${instruction}` : ''}`
    case 'sensory': return `${ctx}Suggest five concrete sensory details (sight, sound, smell, touch, taste) that could enrich this, one per line.`
    case 'brainstorm': return `${ctx}Brainstorm six short, distinct ideas for what could happen next or how to deepen this. One per line.${instruction ? ` Focus: ${instruction}` : ''}`
    case 'consistency': return `${ctx}List any inconsistencies in names, facts, timeline, tone, or point of view. If none, say so briefly.`
    default: return ctx + (instruction || '')
  }
}
