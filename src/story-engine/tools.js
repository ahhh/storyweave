// Creative nudges. Draws are seeded by a shared counter so every peer can reproduce them.
import { createRng, pick, subSeed } from '../util/rng.js'
import { getVariant } from './catalog.js'

export const ORACLE = [
  'A promise becomes a trap.',
  'Someone is right for the wrong reason.',
  'A public victory creates a private loss.',
  'An old obligation arrives at the worst time.',
  'The helper wants something back.',
  'A lie told kindly causes real harm.',
  'Two enemies discover they share a grief.',
  'The map is correct; the traveller is wrong.',
  'What was lost is found — by the wrong person.',
  'Someone overhears exactly half of the truth.',
  'A gift is actually a message.',
  'The safe place stops being safe.',
  'A minor character makes a major decision.',
  'An apology is refused.',
  'The weapon is also the key.',
  'Someone keeps a secret to protect a person who doesn’t deserve it.',
  'A rule is followed perfectly, and disaster follows.',
  'A door that was always locked is found open.',
  'The antagonist is kind to someone in front of the protagonist.',
  'The price has already been paid, by someone else.',
  'A stranger knows the protagonist’s name.',
  'The plan works — and that is the problem.',
  'A beloved object breaks.',
  'Someone leaves without saying goodbye.',
  'The past was edited.',
  'A child sees the truth first.',
  'An ally asks for the one thing the protagonist can’t give.',
  'Time runs out sooner than anyone said.',
  'The quiet character was listening all along.',
  'Mercy turns out to be strategic.',
  'Something small is repeated three times; the third time, it matters.',
  'The rescue arrives, and it is worse than the danger.',
  'The villain’s reasoning is briefly, horribly convincing.',
  'A celebration is interrupted.',
  'The protagonist is mistaken for someone else.',
  'Someone chooses to forget.',
  'An animal behaves strangely.',
  'A letter arrives years late.',
  'The weather mirrors a character’s secret.',
  'A debt is forgiven, and it feels like an insult.',
]

export const MOTIFS = {
  object: ['a cracked pocket watch', 'a borrowed coat', 'a paper crane', 'a brass key with no lock', 'a jar of river stones', 'a torn photograph', 'a ring worn on a string', 'a lantern with blue glass', 'a child’s drawing', 'an unopened letter', 'a chess piece', 'a bent spoon'],
  sound: ['a bell nobody rings', 'rain on tin', 'a whistled tune', 'a dripping tap', 'distant trains', 'wind in wires', 'a door hinge', 'gulls', 'a radio between stations', 'footsteps overhead', 'a kettle', 'a humming refrigerator'],
  colour: ['rust red', 'ultramarine', 'bone white', 'moss green', 'lamp-black', 'saffron', 'bruise violet', 'sea-glass green', 'ochre', 'silver-grey', 'cherry', 'dusk pink'],
  place: ['a closed cinema', 'a flooded orchard', 'a rooftop garden', 'a lighthouse stair', 'a laundromat at 3am', 'a border checkpoint', 'a hospital chapel', 'a greenhouse', 'a salt flat', 'a library basement', 'a night ferry', 'a ruined observatory'],
  phrase: ['“Not yet.”', '“You always say that.”', '“Keep it safe.”', '“Who told you?”', '“I’m still here.”', '“It wasn’t supposed to be you.”', '“Look again.”', '“Remember the river.”', '“One more time.”', '“That’s not my name.”'],
  sensory: ['the smell of burnt sugar', 'cold metal under fingertips', 'the taste of copper', 'woodsmoke in hair', 'sand in shoes', 'the weight of wet wool', 'citrus peel', 'static on skin', 'the light before a storm', 'the warmth of a stone at dusk'],
}

export const CONSTRAINTS = [
  'Do not name a single emotion.',
  'Only dialogue and action — no interiority.',
  'Include one sensory detail per sentence.',
  'Force a choice between two good outcomes.',
  'Repeat an earlier phrase with a different meaning.',
  'Every sentence must be shorter than the last.',
  'Write the passage as someone remembers it years later.',
  'A character must lie in every line of dialogue.',
  'Nobody may say the thing they most want to say.',
  'Include an object from the story bible.',
  'Something must be broken, repaired, or given away.',
  'Write from the point of view of the least important person present.',
  'The passage must include a question that is never answered.',
  'Use the weather to foreshadow what happens next.',
  'Start in the middle of an action.',
  'End on a line of dialogue.',
  'Contradict something a previous writer implied — gently.',
  'Include a sound the reader will hear again later.',
  'No adjectives.',
  'Let silence do the work — one moment where nobody speaks.',
]

export function drawOracle(seed, counter) {
  return pick(ORACLE, createRng(subSeed(seed, 'oracle', counter)))
}

export function drawMotif(seed, counter) {
  const rng = createRng(subSeed(seed, 'motif', counter))
  const kind = pick(Object.keys(MOTIFS), rng)
  return { kind, value: pick(MOTIFS[kind], rng) }
}

export function drawConstraint(seed, counter) {
  return pick(CONSTRAINTS, createRng(subSeed(seed, 'constraint', counter)))
}

export function drawComplication(seed, counter, variantId, beatOrdinal) {
  const rng = createRng(subSeed(seed, 'complication', counter))
  const v = getVariant(variantId)
  const lensList = v?.lens.complications || ORACLE
  const text = pick(lensList, rng)
  const beat = v?.family.beats[beatOrdinal]
  return beat ? `${text} (at “${beat.label}”)` : text
}
