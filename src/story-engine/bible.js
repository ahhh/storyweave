// Story bible: prompt answers grouped by section, each traceable to its source prompt.

export const BIBLE_SECTIONS = [
  { id: 'protagonists', name: 'Protagonists', tags: ['protagonist', 'desire', 'need', 'flaw'] },
  { id: 'supporting', name: 'Supporting characters', tags: ['ally', 'rival', 'mentor', 'antagonist'] },
  { id: 'relationships', name: 'Relationships', tags: ['relationship'] },
  { id: 'setting', name: 'Setting', tags: ['world', 'place'] },
  { id: 'rules', name: 'World rules', tags: ['world-rule', 'scarcity'] },
  { id: 'conflict', name: 'Conflict', tags: ['conflict', 'inciting-incident', 'reversal', 'threshold'] },
  { id: 'stakes', name: 'Stakes', tags: ['stakes', 'sacrifice', 'lowest-point'] },
  { id: 'secrets', name: 'Secrets & clues', tags: ['secret', 'clue', 'twist', 'mystery'] },
  { id: 'themes', name: 'Themes', tags: ['theme', 'theme-question'] },
  { id: 'motifs', name: 'Motifs & style', tags: ['motif', 'sensory', 'tone', 'voice'] },
  { id: 'setpieces', name: 'Set pieces', tags: ['set-piece', 'climax'] },
  { id: 'endings', name: 'Possible endings', tags: ['ending', 'ending-image'] },
]

export function buildBible(ingredients) {
  return BIBLE_SECTIONS.map(section => ({
    ...section,
    entries: ingredients.filter(i => i.tags.some(t => section.tags.includes(t))),
  }))
}
