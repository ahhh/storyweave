// Joseph Campbell's monomyth — the 17 stages from *The Hero with a Thousand Faces* (1949),
// grouped as Departure / Initiation / Return. Stage names are Campbell's; the summaries and
// prompts are StoryWeave's own paraphrase, written to be usable in any genre and any gender.
//
// Each of the 12 normalised beat roles maps onto the stages it most resembles, so every
// arc family (not just the Hero's Journey) can surface Campbell tooltips and prompts.

export const CAMPBELL_STAGES = [
  // ---- prelude ----
  {
    id: 'common-day', phase: 'Prelude', name: 'The World of Common Day',
    gist: 'Before any call, the hero lives in a familiar world that is quietly incomplete. Something is missing, stale, or wounded — even if nobody names it.',
    prompts: [
      'What small thing is broken in the hero’s everyday life that everyone has learned to step around?',
      'What does the hero do every morning, and what would it mean if they stopped?',
      'Who in the ordinary world would be first to notice the hero was gone?',
    ],
  },
  // ---- Departure ----
  {
    id: 'call', phase: 'Departure', name: 'The Call to Adventure',
    gist: 'A herald, blunder, or accident opens a door onto the unknown. The call reveals that the old life can no longer contain the hero.',
    prompts: [
      'Who or what delivers the call — and why does it come to this hero rather than anyone else?',
      'The call arrives by accident. What “mistake” opens the door?',
      'What does the call promise, and what does it quietly threaten?',
    ],
  },
  {
    id: 'refusal', phase: 'Departure', name: 'Refusal of the Call',
    gist: 'The hero turns away — from duty, fear, comfort, or self-interest. Refusal can freeze a life in place; the world goes grey until the call is answered.',
    prompts: [
      'What reasonable excuse does the hero give for saying no?',
      'What does refusing cost — who suffers while the hero hesitates?',
      'What would the hero’s life look like in ten years if they never answered?',
    ],
  },
  {
    id: 'supernatural-aid', phase: 'Departure', name: 'Supernatural Aid',
    gist: 'Once committed, the hero meets a protective guide — often old, strange, or humble — who offers a gift, charm, or piece of knowledge for the road.',
    prompts: [
      'Who appears to help, and why would nobody else take them seriously?',
      'What object or phrase does the helper give that will matter much later?',
      'What does the helper refuse to explain?',
    ],
  },
  {
    id: 'first-threshold', phase: 'Departure', name: 'The Crossing of the First Threshold',
    gist: 'At the edge of the known world stands a guardian. Beyond it lies darkness, danger, and the unknown; crossing means the rules of home no longer apply.',
    prompts: [
      'What guards the border between the known and the unknown here?',
      'What must the hero leave behind to cross?',
      'What is the first thing that is different on the other side?',
    ],
  },
  {
    id: 'belly-of-whale', phase: 'Departure', name: 'The Belly of the Whale',
    gist: 'Rather than conquering the threshold, the hero is swallowed by it — a symbolic death of the old self. Being engulfed is the beginning of rebirth.',
    prompts: [
      'Where is the hero swallowed — a prison, a crowd, a storm, a grief?',
      'What part of the old self does not survive this moment?',
      'In the dark, what does the hero finally admit?',
    ],
  },
  // ---- Initiation ----
  {
    id: 'road-of-trials', phase: 'Initiation', name: 'The Road of Trials',
    gist: 'A sequence of tests, often in threes, that the hero partly fails. Each trial strips away something the hero relied on and reveals hidden help.',
    prompts: [
      'Give three trials — and let the hero fail the first.',
      'Which trial exposes a weakness the hero didn’t know they had?',
      'What secret help, planted earlier, shows up in the middle of a trial?',
    ],
  },
  {
    id: 'meeting-goddess', phase: 'Initiation', name: 'The Meeting with the Goddess',
    gist: 'The hero encounters a love that feels unconditional and complete — a person, place, or vision that shows what wholeness might be.',
    prompts: [
      'Where does the hero experience being fully accepted, perhaps for the first time?',
      'What vision of wholeness does the hero glimpse — and can they hold it?',
      'Who sees the hero exactly as they are and loves them anyway?',
    ],
  },
  {
    id: 'temptation', phase: 'Initiation', name: 'Woman as the Temptress',
    gist: 'Campbell’s label for the temptation stage: the pull of comfort, pleasure, or disgust with the world that could divert the hero from the quest. Here it can be anything or anyone.',
    prompts: [
      'What comfortable life is offered if the hero will just stop here?',
      'What pleasure or escape makes the quest feel pointless?',
      'What does the hero find disgusting in themselves or the world at this point?',
    ],
  },
  {
    id: 'atonement', phase: 'Initiation', name: 'Atonement with the Father',
    gist: 'The hero confronts whatever holds ultimate power over their life — a parent, authority, god, or law. It is both an ordeal and a reconciliation.',
    prompts: [
      'Who or what holds ultimate power over the hero, and what did they demand?',
      'What must the hero forgive — or ask forgiveness for — in this confrontation?',
      'What does the power figure reveal that the hero never wanted to know?',
    ],
  },
  {
    id: 'apotheosis', phase: 'Initiation', name: 'Apotheosis',
    gist: 'Past the ordeal, the hero reaches a higher understanding. Fear falls away; the hero sees beyond the opposites that once defined them.',
    prompts: [
      'What does the hero suddenly understand that dissolves an old fear?',
      'What opposites (friend/enemy, life/death, self/other) stop seeming opposite?',
      'Describe the stillness after the worst has happened.',
    ],
  },
  {
    id: 'ultimate-boon', phase: 'Initiation', name: 'The Ultimate Boon',
    gist: 'The goal of the quest is won — the elixir, treasure, knowledge, or freedom. Often it is different from what the hero set out to find.',
    prompts: [
      'What is the boon — and how is it different from what the hero expected?',
      'Who else could use the boon, and should the hero share it?',
      'What does gaining the boon cost the world the hero is leaving?',
    ],
  },
  // ---- Return ----
  {
    id: 'refusal-of-return', phase: 'Return', name: 'Refusal of the Return',
    gist: 'Having found bliss or wisdom, the hero may not want to return to ordinary life — or doubts that home could ever understand.',
    prompts: [
      'Why would the hero rather stay here than go home?',
      'Who at home would not understand what the hero has become?',
      'What finally convinces the hero to go back?',
    ],
  },
  {
    id: 'magic-flight', phase: 'Return', name: 'The Magic Flight',
    gist: 'Sometimes the boon must be stolen or smuggled out, and the return becomes a pursuit — a wild, often comic, often desperate escape.',
    prompts: [
      'Who is chasing the hero, and what do they want back?',
      'What trick, sacrifice, or thrown obstacle slows the pursuers?',
      'What does the hero drop or lose along the way?',
    ],
  },
  {
    id: 'rescue-from-without', phase: 'Return', name: 'Rescue from Without',
    gist: 'The hero can’t make it back alone. Help arrives from outside — often from people or forces the hero had forgotten, underestimated, or wronged.',
    prompts: [
      'Who comes back for the hero — and why is it surprising?',
      'Which earlier kindness (or cruelty) returns to decide the rescue?',
      'What does the hero have to accept in order to be rescued?',
    ],
  },
  {
    id: 'return-threshold', phase: 'Return', name: 'The Crossing of the Return Threshold',
    gist: 'The hero crosses back into the everyday world, and must bring the wisdom home without losing it — or being dismissed as mad.',
    prompts: [
      'What does home look like now that the hero has been away?',
      'What part of the journey can’t be explained to those who stayed?',
      'What ordinary moment nearly makes the hero forget everything?',
    ],
  },
  {
    id: 'master-two-worlds', phase: 'Return', name: 'Master of the Two Worlds',
    gist: 'The hero learns to live in both worlds — the ordinary and the extraordinary — moving between them with balance.',
    prompts: [
      'What habit shows the hero now belongs to both worlds?',
      'How does the hero use what they learned in an everyday task?',
      'Who else could the hero now guide across?',
    ],
  },
  {
    id: 'freedom-to-live', phase: 'Return', name: 'Freedom to Live',
    gist: 'Freed from the fear of death and change, the hero lives in the present — not anxious about the future or chained to the past.',
    prompts: [
      'What is the hero no longer afraid of?',
      'Describe a moment where the hero is simply, fully present.',
      'What does the hero let go of in the final scene?',
    ],
  },
]

const BY_ID = Object.fromEntries(CAMPBELL_STAGES.map(s => [s.id, s]))

/** Beat role ordinal (0–11) -> Campbell stage ids. */
export const ROLE_TO_CAMPBELL = [
  ['common-day'],
  ['call'],
  ['refusal', 'supernatural-aid'],
  ['supernatural-aid', 'first-threshold'],
  ['belly-of-whale', 'road-of-trials'],
  ['road-of-trials', 'meeting-goddess'],
  ['meeting-goddess', 'temptation'],
  ['temptation', 'atonement'],
  ['atonement', 'belly-of-whale'],
  ['apotheosis', 'ultimate-boon'],
  ['magic-flight', 'rescue-from-without', 'refusal-of-return'],
  ['return-threshold', 'master-two-worlds', 'freedom-to-live'],
]

export const campbellForBeat = ordinal => (ROLE_TO_CAMPBELL[ordinal] || []).map(id => BY_ID[id])
