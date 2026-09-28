// 15 families × 5 lenses × 4 shapes = 300 plot-line variants, plus deterministic outlines.

import { FAMILIES } from './families.js'
import { LENSES, SHAPES, actOf } from './modifiers.js'
import { campbellForBeat } from './campbell.js'
import { createRng, shuffle, pick, subSeed } from '../util/rng.js'

export const CATALOG = FAMILIES.flatMap(f => LENSES.flatMap(l => SHAPES.map(s => ({
  id: `${f.id}.${l.id}.${s.id}`,
  family: f, lens: l, shape: s,
  name: `${f.name} · ${l.name} · ${s.name}`,
}))))

const BY_ID = new Map(CATALOG.map(v => [v.id, v]))
export const getVariant = id => BY_ID.get(id) || null

export function randomVariantId(seed, salt = '') {
  return pick(CATALOG, createRng(subSeed(seed, 'plot', salt))).id
}

const BEAT_QUESTIONS = [
  'What does a stranger notice first about this moment?',
  'Which object in the room will matter later?',
  'Who is lying in this scene, even a little?',
  'What is the weather doing, and does it agree with the mood?',
  'What does the protagonist want in this scene, specifically?',
  'What is left unsaid?',
  'Whose point of view would make this scene hurt more?',
  'What is the cost of the easiest choice here?',
  'How could this beat surprise the reader and still feel inevitable?',
  'What changes between the first and last sentence of this beat?',
  'Where does the humour come from, even here?',
  'Which earlier line could be echoed here with a new meaning?',
]

const FORTUNE_WORDS = { '-2': 'nadir', '-1': 'low', '0': 'even', '1': 'high', '2': 'peak' }

/**
 * Deterministic outline. Never mutates the ingredients passed in.
 * ingredients: [{promptId, answer, tags, question}]
 */
export function buildOutline({ seed, variantId, ingredients }) {
  const variant = getVariant(variantId)
  if (!variant) return null
  const { family, lens, shape } = variant
  const usage = new Map()
  const MAX_PER_BEAT = 2

  const beats = family.beats.map(beat => {
    const rng = createRng(subSeed(seed, 'beat', variantId, beat.ordinal))
    const extra = shape.tags[beat.ordinal] || []
    const preferred = new Set([...beat.preferredTags, ...extra])
    // lens boosts apply to conflict-bearing beats
    const lensBoost = ['disturbance', 'pressure', 'crisis', 'climax'].includes(beat.role) ? lens.boostTags : []
    const optional = new Set([...beat.optionalTags, ...lensBoost])

    const chooseFrom = pool => {
      const shuffled = shuffle(pool, rng)
      shuffled.sort((a, b) => (usage.get(a.promptId) || 0) - (usage.get(b.promptId) || 0))
      return shuffled
    }
    const picked = []
    const take = (list, reason) => {
      for (const ing of list) {
        if (picked.length >= MAX_PER_BEAT) return
        if (picked.some(p => p.promptId === ing.promptId)) continue
        picked.push({ ...ing, reason })
      }
    }
    take(chooseFrom(ingredients.filter(i => i.tags.some(t => preferred.has(t)))), 'match')
    if (picked.length < MAX_PER_BEAT) take(chooseFrom(ingredients.filter(i => i.tags.some(t => optional.has(t)))), 'related')
    if (!picked.length && ingredients.length) take(chooseFrom(ingredients).slice(0, 1), 'wildcard')
    for (const p of picked) usage.set(p.promptId, (usage.get(p.promptId) || 0) + 1)

    const fortune = shape.fortune[beat.ordinal]
    return {
      ...beat,
      lensNote: lens.acts[actOf(beat.ordinal)],
      shapeNote: shape.notes[beat.ordinal] || '',
      fortune,
      fortuneWord: FORTUNE_WORDS[String(fortune)],
      ingredients: picked,
      question: pick(BEAT_QUESTIONS, rng),
      campbell: campbellForBeat(beat.ordinal),
    }
  })
  return { variant, beats }
}

/** Plain-text outline for copy / export. */
export function outlineToText(outline) {
  if (!outline) return ''
  const lines = [outline.variant.name, '']
  for (const b of outline.beats) {
    lines.push(`${b.ordinal + 1}. ${b.label} — ${b.purpose}`)
    lines.push(`   ${b.guidance} ${b.lensNote}${b.shapeNote ? ' ' + b.shapeNote : ''}`)
    for (const i of b.ingredients) lines.push(`   • ${i.answer.replace(/\s+/g, ' ').slice(0, 200)}`)
    lines.push('')
  }
  return lines.join('\n')
}
