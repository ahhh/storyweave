// Built-in prompt templates. Bump LIBRARY_VERSION whenever the list changes order or content,
// because deterministic generation depends on it.
//

export const LIBRARY_VERSION = 1

const T = (id, category, slotTags, question) => ({ id, category, slotTags, question })

export const PROMPT_TEMPLATES = [
  // ---- character ----
  T('ch01', 'character', ['protagonist'], 'Who is our main character, in one sentence that includes something they are ashamed of?'),
  T('ch02', 'character', ['protagonist', 'desire'], 'What does our protagonist want so badly they would lie to get it?'),
  T('ch03', 'character', ['need'], 'What does the protagonist actually need, which they would deny if you told them?'),
  T('ch04', 'character', ['flaw'], 'Name a habit or blind spot that keeps getting the protagonist into trouble.'),
  T('ch05', 'character', ['protagonist'], 'Describe the protagonist’s hands. What do they reveal about their life?'),
  T('ch06', 'character', ['flaw', 'secret'], 'What is a small cruelty the protagonist commits without noticing?'),
  T('ch07', 'character', ['desire'], 'What does the protagonist keep in a pocket, drawer, or bag — and why can’t they throw it away?'),
  T('ch08', 'character', ['ally'], 'Who is the one person who would follow the protagonist anywhere? What do they want in return?'),
  T('ch09', 'character', ['antagonist'], 'Who stands in the way — and what would they say is the reasonable thing they are doing?'),
  T('ch10', 'character', ['antagonist', 'desire'], 'What does the antagonist love that the audience would also love?'),
  T('ch11', 'character', ['mentor', 'ally'], 'Who teaches the protagonist something, and what’s the lesson they get wrong?'),
  T('ch12', 'character', ['rival'], 'Describe a rival who wants the same thing as the protagonist for a better reason.'),
  T('ch13', 'character', ['protagonist', 'need'], 'What would the protagonist’s childhood self be disappointed about?'),
  T('ch14', 'character', ['ally', 'secret'], 'A supporting character has a job no one respects. What is it and why are they good at it?'),
  T('ch15', 'character', ['antagonist', 'flaw'], 'What is the antagonist afraid of, and who knows it?'),

  // ---- relationship ----
  T('re01', 'relationship', ['relationship', 'ally'], 'Two characters share an old debt. Who owes whom, and what was it?'),
  T('re02', 'relationship', ['relationship', 'rival'], 'Describe a friendship that is quietly turning into a rivalry.'),
  T('re03', 'relationship', ['relationship', 'secret'], 'Which two characters are keeping the same secret from each other?'),
  T('re04', 'relationship', ['relationship', 'antagonist'], 'What does the antagonist know about the protagonist that the protagonist has never said aloud?'),
  T('re05', 'relationship', ['relationship'], 'Describe a ritual two characters share — a phrase, a meal, a game.'),
  T('re06', 'relationship', ['relationship', 'sacrifice'], 'Who would the protagonist refuse to leave behind, even if it cost everything?'),
  T('re07', 'relationship', ['relationship', 'mentor'], 'A mentor and student disagree about one thing forever. What is it?'),
  T('re08', 'relationship', ['relationship', 'reversal'], 'Whose loyalty is going to flip before the end, and what will tip it?'),
  T('re09', 'relationship', ['relationship', 'ending-image'], 'Two characters meet again at the very end. What do they say — or not say?'),

  // ---- world ----
  T('wo01', 'world', ['world'], 'Where does the story begin? Give one sound, one smell, and one thing that is broken.'),
  T('wo02', 'world', ['world-rule'], 'What is one rule of this world that everyone obeys but nobody can explain?'),
  T('wo03', 'world', ['scarcity'], 'What is scarce here — water, time, trust, light, silence? Who controls it?'),
  T('wo04', 'world', ['world', 'place'], 'Describe a place the characters are forbidden to go.'),
  T('wo05', 'world', ['world', 'motif'], 'What do people here celebrate, and what does the celebration hide?'),
  T('wo06', 'world', ['world-rule', 'stakes'], 'What happens to people who break the most important rule?'),
  T('wo07', 'world', ['world', 'threshold'], 'Describe the border between the familiar world and the unknown one.'),
  T('wo08', 'world', ['place', 'set-piece'], 'Invent a location perfect for a chase, a confession, or a duel.'),
  T('wo09', 'world', ['world', 'scarcity'], 'What job or trade does this world depend on, and who is paid least for it?'),
  T('wo10', 'world', ['world-rule', 'mystery'], 'Which piece of local history is told wrong on purpose?'),
  T('wo11', 'world', ['place', 'ending-image'], 'Describe a place the characters will return to, changed.'),

  // ---- conflict ----
  T('co01', 'conflict', ['inciting-incident'], 'What happens on an ordinary day that makes this day not ordinary?'),
  T('co02', 'conflict', ['stakes'], 'What will be lost forever if the protagonist fails?'),
  T('co03', 'conflict', ['antagonist', 'conflict'], 'What does the opposing force do first that makes things personal?'),
  T('co04', 'conflict', ['conflict', 'scarcity'], 'Two good people need the same thing and there is only one. What is it?'),
  T('co05', 'conflict', ['stakes', 'sacrifice'], 'What would the protagonist have to give up to win?'),
  T('co06', 'conflict', ['conflict', 'world-rule'], 'Which law, custom, or system makes the problem worse?'),
  T('co07', 'conflict', ['lowest-point'], 'What is the worst thing that could happen at the worst possible moment?'),
  T('co08', 'conflict', ['conflict', 'flaw'], 'How does the protagonist’s own flaw make the conflict harder?'),
  T('co09', 'conflict', ['inciting-incident', 'mystery'], 'A message, stranger, or object arrives unasked-for. What is it?'),
  T('co10', 'conflict', ['stakes', 'relationship'], 'Who else gets hurt if this goes wrong — and do they know it?'),
  T('co11', 'conflict', ['conflict'], 'Name a deadline. What happens at the stroke of it?'),

  // ---- plot ----
  T('pl01', 'plot', ['threshold'], 'What decision can’t be undone once the protagonist makes it?'),
  T('pl02', 'plot', ['reversal'], 'Midway through, what the characters believed turns out to be backwards. What was it?'),
  T('pl03', 'plot', ['twist'], 'Offer a twist that recontextualises the opening scene.'),
  T('pl04', 'plot', ['climax'], 'Where does the final confrontation happen, and why there?'),
  T('pl05', 'plot', ['climax', 'sacrifice'], 'In the climax, what does the protagonist choose that they couldn’t have chosen at the start?'),
  T('pl06', 'plot', ['lowest-point'], 'Describe the moment the protagonist is most alone.'),
  T('pl07', 'plot', ['set-piece'], 'Describe one spectacular scene you’d love to read in this story.'),
  T('pl08', 'plot', ['reversal', 'ally'], 'An ally makes a mistake that changes everything. What is it?'),
  T('pl09', 'plot', ['ending-image'], 'What is the final image of the story?'),
  T('pl10', 'plot', ['threshold', 'mentor'], 'Who or what gives the protagonist a push past the point of no return?'),
  T('pl11', 'plot', ['clue', 'twist'], 'What small detail early on will turn out to matter enormously?'),
  T('pl12', 'plot', ['ending'], 'Does the protagonist get what they wanted, what they needed, both, or neither?'),

  // ---- theme ----
  T('th01', 'theme', ['theme-question'], 'What question is this story asking without answering outright?'),
  T('th02', 'theme', ['theme-question', 'antagonist'], 'What would the antagonist say this story is about?'),
  T('th03', 'theme', ['theme', 'need'], 'What belief does the protagonist hold at the start that the story will test?'),
  T('th04', 'theme', ['theme', 'ending'], 'What is something true about people that this story could prove — or disprove?'),
  T('th05', 'theme', ['theme', 'sacrifice'], 'What is worth losing a friend over, in this story’s world?'),
  T('th06', 'theme', ['theme', 'world'], 'What does this world get wrong about kindness, power, or freedom?'),
  T('th07', 'theme', ['theme-question', 'ending-image'], 'If a reader underlines one sentence in the final page, what does it say?'),

  // ---- mystery ----
  T('my01', 'mystery', ['secret'], 'What secret is the protagonist hiding from everyone?'),
  T('my02', 'mystery', ['secret', 'antagonist'], 'What is the antagonist’s real plan, underneath the obvious one?'),
  T('my03', 'mystery', ['clue'], 'Plant a clue: an object that is in the wrong place.'),
  T('my04', 'mystery', ['mystery', 'world'], 'What has gone missing, and who noticed first?'),
  T('my05', 'mystery', ['clue', 'relationship'], 'Who is lying about where they were, and what were they really doing?'),
  T('my06', 'mystery', ['twist', 'secret'], 'Which character is not who they claim to be?'),
  T('my07', 'mystery', ['mystery', 'inciting-incident'], 'Describe a door, letter, box, or recording that nobody wants opened.'),
  T('my08', 'mystery', ['secret', 'lowest-point'], 'When the secret comes out, who is hurt most?'),
  T('my09', 'mystery', ['clue', 'motif'], 'A symbol keeps appearing — on walls, in dreams, in handwriting. Describe it.'),

  // ---- style ----
  T('st01', 'style', ['motif'], 'Choose a recurring object that should appear at least three times.'),
  T('st02', 'style', ['motif', 'sensory'], 'Choose a sound that should echo through the story.'),
  T('st03', 'style', ['tone'], 'What should this story feel like? Name a weather, a song, and a time of day.'),
  T('st04', 'style', ['tone', 'theme'], 'Is this story funny, sad, eerie, or tender — and where should it surprise us by being something else?'),
  T('st05', 'style', ['motif', 'ending-image'], 'Pick a colour that means something different at the end than at the beginning.'),
  T('st06', 'style', ['voice'], 'Write one line of dialogue the protagonist would never say — then tell us when they finally say it.'),
  T('st07', 'style', ['sensory', 'world'], 'Describe a food, drink, or medicine that only exists in this story.'),
  T('st08', 'style', ['voice', 'protagonist'], 'What phrase does the protagonist repeat when nervous?'),
  T('st09', 'style', ['motif', 'place'], 'A window, a map, a mirror: pick one and say what it shows.'),
  T('st10', 'style', ['tone', 'set-piece'], 'Describe one quiet scene that should exist between two loud ones.'),

  // ---- more depth for larger decks ----
  T('ch16', 'character', ['protagonist', 'relationship'], 'Who does the protagonist call when everything falls apart — and do they answer?'),
  T('ch17', 'character', ['antagonist', 'secret'], 'What kindness has the antagonist done that no one knows about?'),
  T('co12', 'conflict', ['reversal', 'stakes'], 'What victory will turn out to cost more than it looked?'),
  T('pl13', 'plot', ['threshold', 'world'], 'How does the protagonist travel into the unknown — road, river, dream, door, lie?'),
  T('pl14', 'plot', ['lowest-point', 'relationship'], 'Who walks away from the protagonist at the lowest point?'),
  T('wo12', 'world', ['world', 'antagonist'], 'What does the opposing side build, run, or guard?'),
  T('th08', 'theme', ['theme', 'flaw'], 'What does the protagonist forgive at the end that they couldn’t forgive at the start?'),
  T('my10', 'mystery', ['mystery', 'climax'], 'What question must be answered in the final scene?'),
  T('st11', 'style', ['voice', 'tone'], 'Whose point of view should tell this story — and what can’t they see?'),
  T('re10', 'relationship', ['relationship', 'twist'], 'Two characters turn out to be connected in a way neither expected. How?'),
]

// Tiers determine which slots are filled first. Small decks cover the core; larger decks enrich.
export const SLOT_TIERS = [
  ['protagonist', 'desire', 'antagonist', 'stakes', 'inciting-incident', 'climax'],
  ['flaw', 'world', 'threshold', 'lowest-point', 'ending-image', 'need'],
  ['ally', 'world-rule', 'reversal', 'secret', 'theme-question', 'relationship'],
  ['rival', 'mentor', 'motif', 'twist', 'clue', 'sacrifice', 'scarcity'],
  ['set-piece', 'place', 'tone', 'voice', 'sensory', 'theme', 'mystery', 'ending', 'conflict'],
]

export const PRESETS = [
  { id: 'quick', label: 'Quick', count: 6 },
  { id: 'short', label: 'Short', count: 12 },
  { id: 'standard', label: 'Standard', count: 20 },
  { id: 'deep', label: 'Deep', count: 32 },
  { id: 'workshop', label: 'Workshop', count: 48 },
]
