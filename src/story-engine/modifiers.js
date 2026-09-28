// Conflict lenses and narrative shapes — the other two axes of the plot catalog.

// Acts: beats 0–3 = I, 4–7 = II, 8–11 = III
export const actOf = ordinal => (ordinal < 4 ? 0 : ordinal < 8 ? 1 : 2)

export const LENSES = [
  {
    id: 'person', name: 'Person vs. Person', opposition: 'a particular person',
    boostTags: ['antagonist', 'rival', 'relationship'],
    acts: [
      'Give the opposition a face and a name early.',
      'Let the opponent win exchanges; make their logic persuasive.',
      'Settle it between two people, in a space only they share.',
    ],
    complications: [
      'The opponent makes a generous offer with one unacceptable condition.',
      'The opponent reaches someone the protagonist loves first.',
      'A public humiliation engineered by the opponent.',
      'The opponent reveals they have been one step ahead since the opening.',
      'An ally is revealed to share the opponent’s goal.',
      'The opponent is injured, and only the protagonist can help.',
    ],
  },
  {
    id: 'system', name: 'Person vs. System', opposition: 'an institution, law, or society',
    boostTags: ['world-rule', 'scarcity', 'world'],
    acts: [
      'Show the system working smoothly for everyone except those it grinds.',
      'The system absorbs every attack; its agents are just doing their jobs.',
      'Change comes from exploiting the system’s own rules, or at great cost outside them.',
    ],
    complications: [
      'A form, rule, or procedure makes the obvious solution illegal.',
      'The system offers the protagonist a promotion into it.',
      'A deadline imposed by bureaucracy, not malice.',
      'Records are altered; the protagonist officially never existed.',
      'A friend is punished for the protagonist’s defiance.',
      'The system reframes the protagonist as the villain in public.',
    ],
  },
  {
    id: 'nature', name: 'Person vs. Nature', opposition: 'weather, wilderness, illness, or circumstance',
    boostTags: ['world', 'scarcity', 'stakes'],
    acts: [
      'Establish the environment as beautiful and indifferent.',
      'Resources dwindle; the body and the land both push back.',
      'Survival demands adaptation, not domination.',
    ],
    complications: [
      'The weather turns at the worst possible moment.',
      'A supply runs out: water, light, medicine, fuel.',
      'An injury makes the easy route impossible.',
      'The terrain shifts — a bridge collapses, a river floods, ice cracks.',
      'Night falls sooner than expected.',
      'An animal, blight, or fever arrives.',
    ],
  },
  {
    id: 'self', name: 'Person vs. Self', opposition: 'the protagonist’s own fear, flaw, or past',
    boostTags: ['flaw', 'need', 'secret'],
    acts: [
      'Show the inner flaw hurting others while it looks like strength.',
      'External problems keep reflecting the inner one.',
      'The final battle is a choice nobody else can make for them.',
    ],
    complications: [
      'The protagonist’s own lie resurfaces, larger.',
      'A memory intrudes and distorts judgement.',
      'Someone tells the protagonist the truth about themselves.',
      'The protagonist’s coping habit fails at a crucial moment.',
      'They sabotage a good thing just before it succeeds.',
      'They are offered the chance to become who they fear.',
    ],
  },
  {
    id: 'unknown', name: 'Person vs. Unknown', opposition: 'something beyond understanding',
    boostTags: ['mystery', 'clue', 'twist'],
    acts: [
      'The unknown is felt before it is seen.',
      'Each discovery makes the unknown larger, not smaller.',
      'Understanding, if it comes, changes the protagonist more than the threat.',
    ],
    complications: [
      'A sign appears that no one else can see.',
      'Time, distance, or memory behaves wrongly.',
      'A message arrives in the protagonist’s own handwriting.',
      'The unknown imitates someone trusted.',
      'Evidence vanishes the moment it is needed.',
      'The unknown offers an answer to a question the protagonist never asked aloud.',
    ],
  },
]

// fortune: -2 (worst) .. +2 (best) per beat ordinal
export const SHAPES = [
  {
    id: 'rising', name: 'Rising Transformation', blurb: 'Steady climb from lack to fulfilment.',
    fortune: [-1, -1, -1, 0, 0, 1, 1, 0, -1, 1, 2, 2],
    notes: { 6: 'A real gain here, not a false one.', 11: 'End clearly higher than the start.' },
    tags: {},
  },
  {
    id: 'fall-rise', name: 'Fall then Rise', blurb: 'Things get much worse before they get better.',
    fortune: [1, 0, 0, -1, -1, -1, -2, -2, -2, 0, 1, 2],
    notes: { 3: 'Commitment should cost comfort immediately.', 6: 'Make the midpoint a painful defeat.', 9: 'The climb begins from true bottom.' },
    tags: { 6: ['lowest-point'] },
  },
  {
    id: 'double-reversal', name: 'Double Reversal', blurb: 'Two sharp turns of fortune.',
    fortune: [0, 1, 1, 1, 2, 1, -2, -1, -1, 2, 1, 0],
    notes: { 6: 'First reversal: triumph becomes disaster.', 9: 'Second reversal: disaster flips again.', 11: 'End ambiguous — gains and losses both real.' },
    tags: { 6: ['reversal'], 9: ['reversal', 'twist'] },
  },
  {
    id: 'circular', name: 'Circular Return', blurb: 'The story ends where it began — changed.',
    fortune: [0, -1, 0, 1, 0, -1, 1, 0, -1, 0, 1, 0],
    notes: { 0: 'Build an opening image you will return to.', 11: 'Echo the opening image with one crucial difference.' },
    tags: { 0: ['motif'], 11: ['motif'] },
  },
]
