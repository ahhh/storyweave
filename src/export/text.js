import { plainText } from './model.js'

export function toTxt(story) {
  const out = [story.title, '']
  if (story.authors.length) out.push('by ' + story.authors.join(', '), '')
  if (story.premise) out.push(story.premise, '')
  for (const sec of story.sections) {
    if (sec.heading) out.push('', sec.heading.toUpperCase(), '')
    let n = 0
    for (const b of sec.blocks) {
      const t = plainText(b.runs)
      if (b.type === 'hr') out.push('* * *', '')
      else if (b.type === 'heading') out.push(t, '')
      else if (b.type === 'bullet') out.push('• ' + t)
      else if (b.type === 'number') out.push(`${++n}. ${t}`)
      else if (b.type === 'quote') out.push('    ' + t.replace(/\n/g, '\n    '), '')
      else out.push(t, '')
      if (b.type !== 'number') n = 0
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

// Escape characters that Markdown would interpret, so story text stays literal.
const mdEscape = s => s.replace(/([\\`*_{}\[\]<>#|])/g, '\\$1').replace(/^(\s*)([-+]|\d+\.)(\s)/gm, '$1\\$2$3')

function mdRuns(runs) {
  return runs.map(r => {
    if (r.text === '\n') return '  \n'
    let t = mdEscape(r.text)
    const m = /^(\s*)(.*?)(\s*)$/s.exec(t)
    if (!m[2]) return t
    if (r.bold && r.italic) return `${m[1]}***${m[2]}***${m[3]}`
    if (r.bold) return `${m[1]}**${m[2]}**${m[3]}`
    if (r.italic) return `${m[1]}*${m[2]}*${m[3]}`
    return t
  }).join('')
}

export function toMarkdown(story) {
  const out = ['# ' + mdEscape(story.title), '']
  if (story.authors.length) out.push('*by ' + mdEscape(story.authors.join(', ')) + '*', '')
  if (story.premise) out.push('> ' + mdEscape(story.premise), '')
  for (const sec of story.sections) {
    if (sec.heading) out.push('## ' + mdEscape(sec.heading), '')
    let n = 0, inList = false
    for (const b of sec.blocks) {
      const list = b.type === 'bullet' || b.type === 'number'
      if (inList && !list) out.push('')
      inList = list
      if (b.type === 'hr') out.push('---', '')
      else if (b.type === 'heading') out.push('#'.repeat(Math.min(6, b.level + 1)) + ' ' + mdRuns(b.runs), '')
      else if (b.type === 'bullet') out.push('- ' + mdRuns(b.runs))
      else if (b.type === 'number') out.push(`${++n}. ` + mdRuns(b.runs))
      else if (b.type === 'quote') out.push('> ' + mdRuns(b.runs).replace(/\n/g, '\n> '), '')
      else out.push(mdRuns(b.runs), '')
      if (b.type !== 'number') n = 0
    }
    if (inList) out.push('')
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}
