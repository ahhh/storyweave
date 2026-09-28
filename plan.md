# StoryWeave — Cooperative Storytelling Tool
## Engineering Implementation Plan

**Audience:** coding agents, principal engineers, security engineers, QA engineers  
**Target deployment:** GitHub Pages / static hosting  
**Primary deliverable:** a single self-contained `index.html` that runs entirely client-side  
**Participant target:** 1–12 concurrent participants  
**Core exports:** `.txt`, `.md`, `.docx`, plus a project backup format  
**Status:** implementation plan, not a product specification frozen against iteration

---

## 1. Product Goal

Build a cooperative creative-writing application for small groups. Participants should be able to:

1. Join the same story room.
2. See who else is present.
3. Send tailored creative prompts to one another.
4. Answer those prompts.
5. Feed the answers into a deterministic procedural plot generator.
6. Choose or randomize among **200+ plot structures**.
7. Write the story in turn, normally in **1–5 sentence passages**.
8. Edit story text collaboratively in a Google-Docs-like shared editor.
9. Use optional AI assistance on selected text, a plot beat, the outline, or the story-so-far.
10. Export a clean, usable story as `.txt`, `.md`, or `.docx`.
11. Save and restore the full collaborative project.
12. Run from a static GitHub Pages site with no mandatory backend.

The networking implementation must be **transport-agnostic**. The app must expose a minimal adapter API so an external/private networking technique can carry collaboration messages without the story engine needing to know how that transport works.

---

## 2. Product Principles

When implementation details are ambiguous, prefer these rules:

1. **Human authorship wins.** Procedural and AI features suggest; they do not silently replace prose.
2. **No destructive generation.** Regenerating prompts or plots never deletes story text.
3. **Determinism is inspectable.** Same seed and same inputs should be reproducible.
4. **Shared state is explicit.** API keys, browser preferences, and ephemeral presence never enter project state.
5. **Transport is replaceable.** No feature may depend directly on BroadcastChannel, WebRTC, WebSocket, or the private transport.
6. **Peer input is hostile until validated.** Collaboration is a network boundary.
7. **Plain content is safer than executable content.** Avoid arbitrary HTML, scripts, plugins, or imported code.
8. **One-file deployment does not mean one-file source code.** Preserve maintainability, then bundle.
9. **Never promise security the architecture cannot enforce.** Advisory UI permissions are not authorization.
10. **Exports must remain useful outside StoryWeave.** A user should be able to leave with ordinary text, Markdown, and Word files.

---

## 3. Non-Goals for v1

Do **not** expand the first production milestone into a full publishing platform.

Not required for v1:

- user accounts;
- centralized authentication;
- server-side storage;
- payments;
- public discovery;
- moderation infrastructure;
- permanent cloud rooms;
- image generation;
- video/audio chat;
- complex page-layout/DTP tooling;
- tracked changes comparable to Microsoft Word;
- strong permission enforcement between mutually untrusted participants unless the selected networking layer provides verified identities and authorization.

The application may provide **advisory UI permissions** such as “current writer” or “assigned answerer”, but agents must not represent these as security boundaries in a peer-controlled static application.

---

# 4. Principal Architecture Decision

## 4.1 Build as modules; ship as one HTML file

Do **not** author the production application as one hand-written monolithic HTML file.

Recommended repository structure:

```text
/
  src/
    app/
    collaboration/
    editor/
    story-engine/
    prompts/
    ai/
    export/
    persistence/
    security/
    ui/
    util/
  tests/
  scripts/
  public/
  index.template.html
  package.json
  package-lock.json
  vite.config.*
  plan.md
```

The build pipeline should bundle and inline application JavaScript, CSS, and required runtime libraries into:

```text
dist/index.html
```

`dist/index.html` is the GitHub Pages artifact.

## 4.2 Production runtime dependency rule

The production `index.html` should have **no mandatory runtime CDN dependencies**.

Reasons:

- reproducible builds;
- smaller supply-chain attack surface;
- no CDN outage/CORS/version surprises;
- works on more restrictive networks;
- fulfills the “single file” deployment goal.

Optional AI providers and custom networking endpoints are naturally external exceptions.

## 4.3 Recommended technology stack

Use:

- **TypeScript** for source;
- **Yjs** for CRDT shared state;
- **ProseMirror + y-prosemirror** for the primary collaborative rich-text editor;
- **Vite + Rollup** or equivalent for bundling;
- **IndexedDB** for local room persistence;
- **fflate** or another small maintained ZIP implementation for `.docx` generation;
- **Vitest** for unit tests;
- **Playwright** for browser, multi-tab, and multi-peer integration tests.

Alternatives are acceptable only if they preserve the same engineering properties.

---

# 5. High-Level System Layers

```text
┌──────────────────────────────────────────────┐
│ UI / Workspace                               │
├──────────────────────────────────────────────┤
│ Story workflows                              │
│ prompts · plot engine · turns · AI · export  │
├──────────────────────────────────────────────┤
│ Shared application state                     │
│ Yjs CRDT + Awareness                         │
├──────────────────────────────────────────────┤
│ Local persistence                            │
│ IndexedDB                                    │
├──────────────────────────────────────────────┤
│ Collaboration protocol                       │
│ sync · presence · validation · snapshots     │
├──────────────────────────────────────────────┤
│ Pluggable transport                          │
│ BroadcastChannel / private network adapter   │
└──────────────────────────────────────────────┘
```

No upper layer may depend directly on a concrete transport.

---

# 6. Shared State and CRDT Model

## 6.1 One CRDT document per story room

Use a single `Y.Doc` per room/project.

Recommended top-level layout:

```text
Y.Doc
├── meta: Y.Map
├── participants: Y.Map<participantId, Participant>
├── prompts: Y.Map<promptId, PromptMeta>
├── promptOrder: Y.Array<promptId>
├── promptTexts: Y.Map<promptId, Y.Text>
├── promptAnswers: Y.Map<promptId, Y.Text>
├── storyBible: Y.Map<slotId, StoryBibleReference>
├── plot: Y.Map
├── turns: Y.Map
├── story: Y.XmlFragment
├── notes: Y.XmlFragment or Y.Text
├── comments: Y.Map
└── schema: Y.Map
```

### Why Yjs

The collaboration channel may:

- duplicate messages;
- reorder messages;
- temporarily disconnect peers;
- reconnect peers;
- deliver updates through more than one route.

The CRDT layer must tolerate those conditions and converge.

## 6.2 Durable vs. ephemeral state

Durable shared state belongs in Yjs.

Ephemeral collaboration state does not.

Use Yjs Awareness or an equivalent separate presence mechanism for:

- online/offline presence;
- display name/avatar color;
- current editor selection;
- currently viewed plot beat;
- typing state;
- current viewport/editor location.

Suggested values:

- presence heartbeat: every 5 seconds while connected;
- stale after: 15–20 seconds;
- selection updates: debounce/throttle to <= 10 updates/sec.

## 6.3 Participant model

```ts
interface Participant {
  id: string;
  displayName: string;
  symbol?: string;
  colorSeed: number;
  joinedAt: number;
}
```

Maximum roster size: **12**.

Do not treat `displayName` as a unique or authenticated identity.

## 6.4 Schema versioning

Shared documents must contain:

```ts
schemaVersion: number;
appVersion: string;
```

Provide explicit migrations:

```ts
migrateV1ToV2(doc)
migrateV2ToV3(doc)
```

If the app encounters a newer unsupported schema, open read-only where possible and present a clear compatibility error. Do not blindly mutate unknown future documents.

---

# 7. Transport Abstraction

## 7.1 Requirement

The application must not know whether messages travel through:

- `BroadcastChannel`;
- WebRTC;
- WebSocket;
- a private/secret peer network;
- manually bridged messaging;
- another future mechanism.

## 7.2 Transport interface

Define a narrow interface similar to:

```ts
interface StoryTransport {
  start(ctx: {
    roomId: string;
    localPeerId: string;
    onMessage: (message: Uint8Array) => void;
    onStatus?: (status: TransportStatus) => void;
  }): Promise<void> | void;

  send(message: Uint8Array): Promise<void> | void;

  stop(): Promise<void> | void;

  readonly capabilities?: {
    binary?: boolean;
    ordered?: boolean;
    reliable?: boolean;
    peerList?: boolean;
    authenticated?: boolean;
    encrypted?: boolean;
    maxMessageBytes?: number;
  };
}
```

If the private networking technique supports strings only, provide a wrapper using base64url.

Do **not** force base64 into the internal protocol when binary delivery is available.

## 7.3 Reference transport

Implement `BroadcastChannelTransport` first.

Purpose:

- zero-setup local development;
- multi-tab testing;
- reference adapter implementation;
- proof that story code is transport-independent.

## 7.4 Wire protocol

Use a versioned binary envelope or a compact validated envelope containing typed payloads.

Logical message types:

```text
HELLO
STATE_VECTOR
STATE_DIFF
YJS_UPDATE
AWARENESS
PING
PONG
GOODBYE
ERROR
```

The private transport should only need to carry opaque bytes.

## 7.5 Join synchronization

On joining:

1. load locally cached room state;
2. start transport;
3. send `HELLO`;
4. send Yjs state vector;
5. peers respond with only the required state diff;
6. apply valid remote updates;
7. merge local/remote state;
8. begin normal incremental sync.

Do not send a full project snapshot on every edit.

## 7.6 Collaboration protocol invariants

The protocol must tolerate:

- duplicate messages;
- out-of-order messages;
- late peers;
- temporary network partitions;
- reconnecting peers with stale local state.

It must not require a permanent authoritative host for correctness.

A leader may be elected for optional coordination, but story convergence cannot depend on it.

---

# 8. Local Persistence

## 8.1 IndexedDB

Persist every room locally.

Reloading the page must not destroy work.

Suggested key namespace:

```text
storyweave::<origin>::<room-id>
```

## 8.2 User controls

Provide:

- Download project backup;
- Import project backup;
- Forget local copy of this room;
- Duplicate story as new room;
- Create new story.

Destructive local deletion requires confirmation.

## 8.3 Backup format

Use a versioned `.json` or custom `.storyweave` file.

Example:

```json
{
  "format": "storyweave-project",
  "formatVersion": 1,
  "schemaVersion": 1,
  "exportedAt": "ISO-8601",
  "roomLabel": "...",
  "yjsUpdateBase64": "..."
}
```

Do not deserialize executable formats or use `eval`-like behavior.

---

# 9. Prompt Relay

## 9.1 Purpose

Participants send creative questions to one another. Answers become structured story ingredients that the plot generator can reuse.

## 9.2 Prompt template model

Each built-in prompt:

```ts
interface PromptTemplate {
  id: string;
  category:
    | "character"
    | "relationship"
    | "world"
    | "conflict"
    | "plot"
    | "theme"
    | "mystery"
    | "style";
  slotTags: string[];
  question: string;
  minRecommendedLength?: number;
}
```

Maintain at least **75 high-quality prompt templates** for v1.

Example slot tags:

```text
protagonist
desire
need
flaw
ally
rival
antagonist
stakes
world
world-rule
scarcity
inciting-incident
threshold
reversal
lowest-point
twist
climax
ending-image
theme-question
motif
secret
clue
sacrifice
```

## 9.3 Tailoring

After generation, the assigned sender may rewrite the question before the recipient answers.

Both the tailored prompt and response are shared CRDT text.

Ownership restrictions are advisory unless the networking layer provides authenticated authorization.

## 9.4 Prompt count

Recommended range:

```text
4–48
```

Presets:

- Quick: 6
- Short: 12
- Standard: 20
- Deep: 32
- Workshop: 48

The chosen count should materially influence the generated outline:

- low counts use core story slots;
- higher counts progressively enrich relationships, setting, theme, subplots, motifs, and reversals.

## 9.5 Deterministic prompt generation

For the same:

```text
seed
prompt-library version
participant roster/order
question count
assignment mode
```

the app should generate the same initial prompt set and assignment plan.

Do not use `Math.random()` for deterministic story generation.

## 9.6 Assignment modes

Implement:

1. **Round Robin** — A asks B, B asks C, etc.
2. **Cross Room** — use participant-ring offset to maximize cross-group interaction.
3. **Seeded Shuffle** — deterministic random pairings; avoid self-assignment where possible.
4. **Manual** — explicit sender and recipient selection.

---

# 10. Story Bible

Prompt answers should remain visible and attributable to their source prompts.

Build a human-readable story bible with sections for:

- protagonists;
- supporting characters;
- relationships;
- setting;
- world rules;
- conflict;
- stakes;
- secrets;
- themes;
- motifs;
- set pieces;
- possible endings.

Every generated plot beat should be able to show which story-bible answers influenced it.

Traceability is important for collaborative trust.

---

# 11. Procedural Plot / Hero's Arc Engine

## 11.1 Requirement

Expose **more than 200 selectable structural plot lines**.

Do not satisfy this requirement by storing 200 trivial renames of the same structure.

Use a compositional engine with materially different structures.

## 11.2 v1 structural matrix

Recommended:

- **15 arc families**
- **5 conflict lenses**
- **4 narrative shapes**

Total:

```text
15 × 5 × 4 = 300 plot-line variants
```

### Arc families

At least:

1. Hero's Journey
2. Three-Act Quest
3. Five-Act Tragedy
4. Mystery Spiral
5. Heist Clock
6. Romance / Bond Arc
7. Redemption Arc
8. Coming-of-Age
9. Horror Descent
10. Voyage and Return
11. Rebellion / Underdog
12. Fable / Moral Transformation
13. Puzzle Box / Reality Bend
14. Ensemble Mosaic
15. Quest for Meaning

### Conflict lenses

At least:

1. person vs. person;
2. person vs. system;
3. person vs. nature/circumstance;
4. person vs. self;
5. person vs. unknown.

### Narrative shapes

At least:

1. rising transformation;
2. fall then rise;
3. double reversal;
4. circular return.

## 11.3 Beat model

Normalize each arc family to approximately **12 beats**.

```ts
interface PlotBeat {
  id: string;
  ordinal: number;
  label: string;
  purpose: string;
  guidance: string;
  preferredTags: string[];
  optionalTags: string[];
}
```

The UI may hide or merge beats for short forms, but the structure model remains stable.

## 11.4 Ingredient slotting algorithm

For each beat:

1. collect story-bible answers matching preferred semantic tags;
2. choose up to N matching ingredients deterministically;
3. if insufficient, use optional tags;
4. if still insufficient, choose seeded fallback answers not yet overused;
5. preserve source answer IDs;
6. render:
   - structural purpose;
   - chosen ingredients;
   - optional creative question;
   - user-editable beat notes.

The engine must **suggest structure**, not overwrite human prose.

## 11.5 Plot selection UX

Provide:

- searchable plot-line dropdown;
- family/lens/shape filters;
- “randomize from seed”;
- “randomize new”;
- favorite/pin;
- compare two structures;
- copy outline.

Changing structure must never delete prose.

When beat mapping changes, remap by stable semantic role where possible. If ambiguous, show a remapping UI instead of silently moving or dropping writing.

---

# 12. Determinism

Create one RNG module:

```ts
seedToUint32(seed: string): number
createRng(seed: string): Rng
shuffle<T>(items: T[], rng: Rng): T[]
pick<T>(items: T[], rng: Rng): T
```

Define stable sub-seeds:

```text
<seed>/prompts
<seed>/assignments
<seed>/plot
<seed>/beat/<id>
<seed>/oracle/<counter>
```

Never accidentally mix seeded and non-deterministic randomness.

Unit-test fixed seed vectors.

---

# 13. Round-Robin Writing

## 13.1 Turn system

Default behavior:

- participants appear in a writer order;
- current writer is visibly highlighted;
- submitting a passage advances the turn;
- after all participants write, the round increments;
- suggested plot beat advances automatically but can be overridden.

Provide:

- reset/reorder turn order;
- seeded random order;
- manual order;
- pass;
- skip absent participant;
- free-turn mode.

## 13.2 Passage size

Default target:

```text
1–5 sentences
```

Use soft validation, not a destructive hard limit.

Reasons:

- abbreviations make sentence counting imperfect;
- dialogue punctuation complicates heuristics;
- creative writing should not be blocked by sentence parsing.

## 13.3 Contribution metadata

Every contributed block should track:

```ts
authorId
createdAt
lastEditedAt
originTurn
originBeatId
```

Do not represent this metadata as cryptographically verified authorship unless signatures/authenticated identity are added later.

---

# 14. Google-Docs-Like Editing

## 14.1 Main editor

Use a ProseMirror document shared through Yjs.

Minimum formatting:

- paragraph;
- heading;
- bold;
- italic;
- blockquote;
- horizontal rule;
- bulleted list;
- numbered list.

Keep the schema intentionally small.

## 14.2 Collaborative features

Implement:

- live concurrent edits;
- remote cursors/selections;
- collaborator labels/colors;
- “currently editing” indicators;
- visible save/sync status;
- comments or margin notes;
- plot beat headings as navigable anchors;
- word count;
- optional focus mode.

## 14.3 Comments

Use stable relative positions where possible.

Prefer Yjs relative positions rather than raw character indexes.

Each comment:

```ts
id
authorId
createdAt
resolved
body
anchorStart
anchorEnd
```

## 14.4 Undo/redo

Full Google-Docs-style revision history is not required in v1.

Minimum:

- local undo/redo with `Y.UndoManager`;
- per-user scope where practical;
- downloadable full project backup.

---

# 15. Creative Collaboration Features

Include lightweight tools that encourage play without taking over authorship.

## 15.1 Story Oracle

Seeded nudges such as:

- a promise becomes a trap;
- someone is right for the wrong reason;
- a public victory creates a private loss;
- an old obligation arrives at the worst time.

## 15.2 Motif Generator

Suggest recurring:

- objects;
- sounds;
- colors;
- locations;
- phrases;
- sensory details.

## 15.3 Scene Constraint

Examples:

- do not name an emotion;
- only dialogue and action;
- include one sensory detail per sentence;
- force a choice between two good outcomes;
- repeat an earlier phrase with a different meaning.

## 15.4 Complication Button

Generate a new obstacle linked to the current beat.

## 15.5 Character / Relationship Cards

Allow pinning compact notes for:

- want;
- need;
- fear;
- secret;
- relationship;
- contradiction;
- current status.

## 15.6 Parking Lot

Provide a shared area for:

- cut lines;
- unused ideas;
- alternate scenes;
- unresolved questions.

---

# 16. AI Assistance

## 16.1 Architectural rule

AI is optional.

The application must remain fully usable when every AI feature is disabled.

## 16.2 No embedded secrets

A GitHub Pages application is public client-side code.

Therefore:

**Never place a private/shared API key inside `index.html`, JavaScript, the repository, build-time substitutions that reach the browser, or URLs.**

Anything delivered to the browser is recoverable by the browser user.

## 16.3 AI scopes

Support:

- selected text;
- current paragraph;
- current plot beat;
- full outline;
- story so far;
- brainstorm only;
- continue for N sentences;
- rewrite with instruction;
- dialogue alternatives;
- sensory-detail suggestions;
- consistency check.

## 16.4 Explicit send preview

Before remote generation, show:

- provider;
- model;
- exact scope;
- approximate character/token count;
- whether participant names are included;
- confirmation button.

AI calls must never happen silently.

## 16.5 Key storage

Default:

- keep provider API key **in memory only**.

Optional:

- “remember until this tab closes” using `sessionStorage`.

Do not use `localStorage` for API keys by default.

Never place API keys in:

- Yjs shared state;
- IndexedDB room state;
- exports;
- logs;
- URL parameters;
- presence messages.

## 16.6 Provider interface

```ts
interface TextGenerationProvider {
  id: string;
  displayName: string;

  configure(settings: unknown): void;

  generate(req: {
    system?: string;
    prompt: string;
    maxOutputTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  }): Promise<{
    text: string;
    model?: string;
    usage?: unknown;
  }>;
}
```

Initial adapters may include:

- generic OpenAI-compatible HTTP endpoint;
- one or more current providers with free tiers;
- optional local/in-browser generation where device capability permits.

Do not make “permanently free” a correctness assumption. Free tiers change.

## 16.7 Local AI research task

One agent should prototype a no-key browser model option.

Evaluate:

- WebGPU availability;
- initial model download size;
- memory requirements;
- mobile support;
- generation speed;
- licensing;
- caching behavior;
- whether lazy model downloads are compatible with the single-file deployment goal.

Ship only if the user experience is acceptable.

## 16.8 Model output handling

Treat AI output as **untrusted text**.

- Never insert model output using raw `innerHTML`.
- Never execute code returned by a model.
- Insert only as text or schema-approved editor nodes.
- Require human action before AI output becomes canonical story text.

---

# 17. Export System

All export formats must be generated from a normalized story model, not by scraping rendered UI HTML.

## 17.1 Normalized export model

```ts
interface ExportStory {
  title: string;
  subtitle?: string;
  premise?: string;
  authors: string[];
  plotLineName: string;
  seed: string;
  sections: Array<{
    heading: string;
    blocks: ExportBlock[];
  }>;
}
```

## 17.2 `.txt`

Requirements:

- UTF-8;
- title;
- optional premise;
- clean section headings;
- blank lines between paragraphs;
- no internal UI metadata unless explicitly requested.

## 17.3 `.md`

Requirements:

- valid UTF-8 Markdown;
- `#` title;
- `##` section headings;
- preserve supported emphasis/list formatting;
- optional metadata only when explicitly enabled.

## 17.4 `.docx`

Generate valid Office Open XML in-browser.

Recommended process:

1. create semantic WordprocessingML;
2. XML-escape all user content;
3. package required files as ZIP;
4. emit MIME type:
   `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.

Minimum package should include:

```text
[Content_Types].xml
_rels/.rels
word/document.xml
word/styles.xml
word/_rels/document.xml.rels
docProps/core.xml
docProps/app.xml
```

Do not transform arbitrary user HTML directly into OOXML.

## 17.5 Export options

Allow optional inclusion of:

- author names;
- plot outline;
- story bible;
- notes;
- unresolved comments;
- prompt answers.

Default story export should contain **story prose**, not workshop scaffolding.

---

# 18. Security Threat Model

Assume:

1. the GitHub Pages application is public;
2. a malicious participant may gain access to a room if they gain access through the networking mechanism;
3. a malicious peer may send arbitrary bytes rather than valid collaboration messages;
4. story content may contain hostile HTML/JavaScript-like strings, malformed Unicode, or extremely long text;
5. AI output is untrusted;
6. imported backups are untrusted;
7. the external transport may be reliable, unreliable, authenticated, unauthenticated, encrypted, or unencrypted;
8. a participant may intentionally attempt to exhaust CPU, memory, storage, or bandwidth.

The application must remain safe under those assumptions.

---

# 19. Security Controls

## 19.1 DOM XSS prevention

This is a release-blocking area.

Rules:

- never use `innerHTML` with participant/story/AI/imported content;
- render untrusted text via `textContent` or framework-equivalent escaped bindings;
- constrain rich text through the ProseMirror schema;
- sanitize pasted HTML;
- strip unsupported nodes and attributes;
- validate all user-provided links;
- reject unsafe URL schemes such as `javascript:`;
- do not support arbitrary HTML embeds in v1.

## 19.2 Content Security Policy

The final bundled HTML should use a restrictive CSP.

Target shape:

```text
default-src 'none';
script-src <build-generated-hash>;
style-src <build-generated-hash>;
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' https: wss:;
worker-src 'self' blob:;
manifest-src 'self';
object-src 'none';
base-uri 'none';
form-action 'none';
frame-ancestors 'none';
```

Because this is a single-file build, generate hashes for inline script/style blocks.

Avoid `unsafe-eval`.

Avoid `unsafe-inline` if the build can eliminate it.

Any exceptions required by local-AI runtimes must be narrowly documented.

## 19.3 Network message validation

Before parsing/processing transport messages:

- enforce maximum message size;
- validate protocol version;
- validate message type;
- reject malformed envelopes;
- reject or ignore wrong-room messages;
- rate-limit peers;
- guard decompression if compression is introduced later.

Recommended initial cap:

```text
1 MiB per normal collaboration message
```

Large state synchronization should use bounded chunking rather than bypass limits.

## 19.4 Denial-of-service guardrails

Protect against:

- update floods;
- awareness floods;
- giant text pastes;
- unbounded prompt creation;
- unbounded comments;
- oversized imports.

Suggested v1 limits:

```text
participants: 12
prompts: 100 hard maximum
comments: 2,000 hard maximum
single text paste warning: 1 MiB
project import: 20 MiB hard maximum
awareness sends: <= 10/sec/peer
```

Tune after profiling.

## 19.5 Identity spoofing

If the transport does not provide authenticated peer identity, the app cannot securely prove who authored a change.

The UI must not claim otherwise.

Possible future enhancements:

- transport-provided identity;
- public-key peer identities;
- signed authorship metadata.

Do not invent a fragile custom cryptographic identity system in v1.

## 19.6 Confidentiality

If the private networking technique does not guarantee encryption, story text may be observable in transit.

Transport capability metadata should include:

```ts
authenticated?: boolean;
encrypted?: boolean;
```

Display security status only when the transport can truthfully assert it.

Optional future layer: audited application-level end-to-end encryption.

Do not block v1 on home-grown E2EE.

## 19.7 Imported project files

Treat backups as hostile.

- enforce size limit before reading;
- JSON-only for v1 project import;
- validate required fields;
- validate format/schema versions;
- decode base64 defensively;
- never use `eval`;
- never import scripts, HTML, CSS, or executable URLs from project files.

## 19.8 AI privacy boundary

Remote AI is a data-export boundary.

Clearly tell users when content will leave the browser.

Never automatically send:

- the full story;
- participant identities;
- room identifiers;
- private notes;

unless that exact scope is explicitly selected.

## 19.9 Logging

Production builds must not log:

- story content;
- API keys;
- collaboration update payloads;
- full AI prompts;
- imported backup content.

Development logging must be disabled or compiled out for production.

## 19.10 Dependency security

Requirements:

- lockfile committed;
- exact dependency versions;
- dependency audit in CI;
- license inventory;
- avoid abandoned dependencies for security-sensitive parsing/ZIP work;
- review dependency additions during code review.

---

# 20. UI / Information Architecture

Recommended primary navigation:

```text
Overview
Participants
Prompt Relay
Story Bible
Plot Engine
Write
Scratchpad
AI Assist
Export
Connection
```

## 20.1 Overview

Show:

- story title;
- premise;
- seed;
- participant count;
- answered prompts;
- story word count;
- selected plot line;
- current writer;
- current synchronization status.

## 20.2 Write workspace

Desktop layout:

```text
left: outline / beats
center: collaborative editor
right: participants / comments / current turn
```

Mobile:

- outline becomes a drawer;
- comments become a drawer;
- editor gets full width.

## 20.3 Accessibility

Minimum:

- keyboard-accessible controls;
- visible focus states;
- semantic labels;
- no color-only status;
- screen-reader names for collaborator indicators;
- sufficient contrast;
- respect `prefers-reduced-motion`;
- dialogs trap focus and restore it when closed.

---

# 21. Connection UX

Provide a compact connection panel.

Display:

- transport name;
- state: disconnected / connecting / synchronized / degraded;
- peer count if available;
- whether transport reports encryption/authentication;
- local persistence status.

Do not expose low-level CRDT logs to ordinary users.

A developer diagnostics panel may exist behind a dev flag.

---

# 22. Multi-Agent Work Breakdown

Agents should work against shared interfaces and tests, not independently invent incompatible data models.

## Agent 0 — Integration / Principal Engineer

Owns:

- repository bootstrap;
- TypeScript config;
- build pipeline;
- single-file output;
- shared type definitions;
- architecture boundaries;
- integration branch;
- schema version;
- dependency decisions;
- release coordination.

Deliverables:

- `dist/index.html` generated by one command;
- architecture README;
- CI pipeline;
- common interfaces/types;
- release checklist.

Must merge foundation interfaces before feature agents diverge.

---

## Agent 1 — CRDT / Collaboration

Owns:

- Yjs document schema;
- migrations;
- sync protocol integration;
- awareness;
- local undo manager;
- state-vector synchronization;
- persistence integration contract.

Acceptance tests:

- two tabs edit the same text concurrently and converge;
- disconnected tab rejoins and converges;
- duplicate and out-of-order update replay converges;
- remote cursor state expires cleanly;
- reload restores locally persisted state.

---

## Agent 2 — Transport / Networking Adapter

Owns:

- `StoryTransport` interface;
- `BroadcastChannelTransport`;
- string-only base64url adapter;
- reconnect/status model;
- packet framing and validation;
- rate-limiting hooks;
- public bridge API for private networking.

Required integration example:

```ts
const transport = new ExternalStoryTransport({
  send: bytes => secretNetwork.send(bytes),
  subscribe: cb => secretNetwork.onMessage(cb)
});

app.setTransport(transport);
```

No story-engine code may reference the private networking implementation directly.

---

## Agent 3 — Prompt Relay / Story Bible

Owns:

- prompt template library;
- deterministic prompt selection;
- assignment modes;
- tailoring UI;
- answer UI;
- story-bible extraction;
- source traceability.

Acceptance tests:

- fixed seed produces fixed prompt order;
- participant names render safely;
- answers survive reconnect/reload;
- changing one answer updates its story-bible slot without deleting prose;
- maximum prompt limit is enforced.

---

## Agent 4 — Plot Engine

Owns:

- arc families;
- conflict lenses;
- narrative shapes;
- 300-variant catalog;
- beat models;
- deterministic ingredient slotting;
- randomize/compare/favorite;
- beat remapping when structure changes.

Acceptance tests:

- catalog size >= 200;
- target catalog size = 300;
- every catalog entry resolves to a valid beat structure;
- same seed + same inputs produces the same outline;
- beat generation never mutates source answers;
- plot changes never delete story prose.

---

## Agent 5 — Editor / Turn System / UI

Owns:

- ProseMirror editor;
- y-prosemirror integration;
- remote cursors;
- turn indicators;
- round logic;
- beat navigation;
- sentence target;
- comments;
- scratchpad;
- responsive workspace.

Acceptance tests:

- concurrent typing does not overwrite peers;
- formatting converges across tabs;
- one user's undo does not unexpectedly remove another user's unrelated change;
- turn UI advances predictably;
- 1–5 sentence heuristic warns without corrupting text;
- keyboard-only navigation is viable.

---

## Agent 6 — Export / Import

Owns:

- normalized export model;
- TXT export;
- Markdown export;
- DOCX export;
- project backup;
- project restore.

Acceptance tests:

- Unicode survives all export formats;
- XML special characters survive DOCX;
- generated DOCX opens in Word or LibreOffice test environment;
- Markdown contains no raw CRDT metadata;
- backup/restore reproduces document state.

---

## Agent 7 — AI Integration

Owns:

- provider interface;
- BYOK UI;
- send-scope preview;
- abort/cancel;
- result staging;
- local-AI research prototype;
- explicit insertion workflow.

Acceptance tests:

- API keys never enter shared Yjs state;
- API keys never appear in backups;
- failed CORS/network request gives a useful error;
- cancel uses `AbortController`;
- malicious HTML returned by a model renders as inert text;
- story text is not sent until user explicitly confirms.

---

## Agent 8 — Security Engineering

Owns an independent review of all other work.

Tasks:

- threat-model review;
- DOM XSS review;
- paste sanitization;
- URL validation;
- wire-size enforcement;
- rate limiting;
- import validation;
- CSP;
- dependency review;
- AI privacy review;
- malicious peer testing;
- release security signoff.

Security may block release for critical issues.

---

## Agent 9 — QA / Browser Compatibility

Owns:

- Playwright multi-tab tests;
- Chromium;
- Firefox;
- WebKit where feasible;
- responsive/mobile checks;
- reload/offline tests;
- export smoke tests;
- accessibility smoke tests;
- long-session soak tests.

---

# 23. Merge Order

Recommended dependency order:

```text
Phase A
Agent 0: scaffold + shared types + build

Phase B
Agent 1: CRDT schema
Agent 2: transport
Agent 9: test harness

Phase C
Agent 3: prompt relay
Agent 4: plot engine
Agent 5: editor shell

Phase D
Agent 5: full collaboration UX
Agent 6: exports
Agent 7: AI

Phase E
Agent 8: security hardening
Agent 9: cross-browser + soak
Agent 0: release integration
```

Do not merge AI or export work against an unstable, ad hoc story model.

---

# 24. Testing Strategy

## 24.1 Unit tests

Required areas:

- seeded RNG;
- prompt selection;
- participant assignment;
- plot catalog generation;
- beat ingredient slotting;
- sentence count heuristic;
- export transforms;
- XML escaping;
- protocol envelope validation;
- schema migrations.

## 24.2 Property tests

Useful invariants:

- shuffle preserves every input exactly once;
- deterministic functions return identical output for identical seed/input;
- XML export never emits raw unescaped XML text characters;
- protocol decoder never causes an uncaught exception for arbitrary bytes;
- changing a plot cannot reduce the count of story prose nodes without explicit user deletion.

## 24.3 Multi-peer integration tests

Playwright should create 2–12 browser contexts/tabs.

Core scenario:

1. all peers join;
2. concurrent edits occur;
3. one peer disconnects;
4. others continue;
5. disconnected peer edits locally;
6. peer reconnects;
7. all replicas converge.

Also test:

- duplicate packets;
- shuffled packet order;
- one participant;
- twelve participants;
- rapid prompt editing;
- plot structure change during active writing;
- browser reload mid-edit;
- room import while connected.

## 24.4 Security regression tests

Inject strings such as:

```text
<script>alert(1)</script>
<img src=x onerror=alert(1)>
javascript:alert(1)
"><svg/onload=alert(1)>
& < > " '
```

Also test:

- very long Unicode strings;
- malformed or edge-case Unicode;
- oversized protocol frames;
- malformed backup JSON;
- malicious AI output.

Test these in:

- participant name;
- prompt;
- answer;
- story prose;
- comment;
- AI output;
- imported project metadata.

Nothing should execute.

## 24.5 Export tests

DOCX automated checks:

- output is valid ZIP;
- required files exist;
- XML parses;
- story text can be extracted from `word/document.xml`;
- user text containing `&`, `<`, `>`, quotes, emoji, and non-Latin scripts round-trips.

Manual compatibility checklist:

- Microsoft Word;
- LibreOffice Writer;
- Apple Pages if available.

---

# 25. Performance Targets

Initial targets on a modern laptop:

- first interactive load: < 2 seconds, excluding optional AI-model downloads;
- normal update processing after transport delivery: < 100 ms overhead;
- 12-peer room remains responsive;
- 100,000-word story remains editable;
- normal Yjs update handling does not block the main thread for > 50 ms;
- export of a 100,000-word story completes without crashing the tab.

Profile before optimizing.

---

# 26. GitHub Pages Build and Release

Target commands:

```bash
npm ci
npm test
npm run build
npm run test:e2e
```

Build artifact:

```text
dist/index.html
```

## CI release gate

Fail release if:

- unit tests fail;
- collaboration e2e test fails;
- plot catalog count < 200;
- generated HTML references unexpected remote script/style assets;
- unresolved critical dependency vulnerability exists;
- CSP is missing from production build;
- output file cannot initialize in a clean browser profile.

---

# 27. Definition of Done — MVP

The MVP is done only when all of the following are demonstrably true:

- [ ] `dist/index.html` can be hosted on GitHub Pages.
- [ ] Core writing works without any backend.
- [ ] 1–12 participants are supported.
- [ ] Two or more peers can edit concurrently and converge.
- [ ] The private networking adapter can replace the default transport without changing story features.
- [ ] Local room state survives reload.
- [ ] Prompt relay supports tailored questions and answers.
- [ ] Prompt count is configurable.
- [ ] Prompt answers populate a visible story bible.
- [ ] At least 200 plot lines are selectable; target catalog is 300.
- [ ] Plot generation is deterministic from seed and inputs.
- [ ] Users can randomize plot structure.
- [ ] Changing plot structure does not delete prose.
- [ ] Round-robin turn order works.
- [ ] Writers can target any plot beat.
- [ ] 1–5 sentence target is visible and softly validated.
- [ ] Shared rich-text editing works.
- [ ] Remote collaborators/cursors are visible.
- [ ] Scratchpad works.
- [ ] Story oracle/constraint/complication tools work.
- [ ] `.txt` export works.
- [ ] `.md` export works.
- [ ] `.docx` export opens successfully in a standard word processor.
- [ ] Full project backup/restore works.
- [ ] AI is optional.
- [ ] Remote AI requires explicit user action.
- [ ] No shared API key is embedded.
- [ ] AI keys are not synchronized or exported.
- [ ] No known stored/reflected DOM XSS path exists.
- [ ] Production CSP is active.
- [ ] Malformed transport input does not crash the app.
- [ ] Automated multi-peer convergence tests pass.

---

# 28. Stretch Goals After MVP

Only after MVP is stable:

- scene cards / corkboard;
- branching alternate timelines;
- character relationship graph;
- secret objectives visible only to selected peers where the transport/security model supports it;
- voting on plot branches;
- timed writing rounds;
- writing games;
- anonymous contribution mode;
- spectator mode;
- Markdown import;
- Fountain screenplay export;
- EPUB export;
- PDF export;
- version snapshots;
- semantic consistency linting;
- local embeddings for continuity search;
- local browser LLM;
- optional audited application-level E2EE;
- signed peer identities;
- plugin architecture for additional arc families and prompt decks.

---

# 29. Open Engineering Questions

Agents should not block the scaffold on these, but they must be resolved before release where they affect correctness or security.

## Private transport constraints

Determine:

- bytes or strings?
- reliable?
- ordered?
- peer-to-peer or broadcast?
- maximum packet size?
- peer identity available?
- encrypted?
- authenticated?
- replay behavior?
- room membership lifecycle?

## Rich-text bundle size

Determine:

- acceptable final `index.html` size;
- whether ProseMirror/Yjs bundling stays within target;
- whether source maps are excluded from production artifact.

## Local AI

Determine:

- whether browser model download/runtime costs are acceptable;
- whether mobile support is worth retaining in the same UI.

## DOCX fidelity

Determine whether v1 exports:

- plain manuscript formatting only;
- or richer styles/comments/author metadata.

## Room identifiers

Determine whether room identifiers are:

- merely labels;
- capability URLs;
- secrets;
- or transport-owned identifiers.

No security property should depend on an unresolved assumption.

---

# 30. First Sprint — Thin Vertical Slice

Before polishing or expanding content libraries, produce a thin end-to-end slice.

A generated `dist/index.html` should:

1. open a room;
2. create/load a Yjs document from IndexedDB;
3. synchronize two tabs with BroadcastChannel;
4. show two participants through awareness;
5. allow concurrent editing of one ProseMirror document;
6. allow one seeded prompt to be answered;
7. generate one deterministic 12-beat plot using that answer;
8. export current prose as `.txt`;
9. expose the external transport adapter interface;
10. pass a basic XSS smoke test.

Only after this vertical slice is solid should agents expand horizontally into:

- full prompt library;
- 300 plot variants;
- full round-robin UX;
- DOCX;
- AI;
- comments;
- creative tools;
- advanced security hardening.

---

# 31. Recommended Agent Coordination Protocol

Because multiple coding agents will work in parallel, the project needs explicit coordination rules.

## 31.1 Shared contracts first

Before feature branches begin, Agent 0 should merge:

- shared types;
- `StoryTransport`;
- CRDT top-level schema names;
- normalized export model;
- seeded RNG interface;
- public application event interface.

No feature agent should redefine these locally.

## 31.2 Branch ownership

Suggested branch prefixes:

```text
core/
collab/
transport/
prompts/
plot/
editor/
export/
ai/
security/
qa/
```

Avoid multiple agents editing the same foundational file unless coordinated.

## 31.3 Contract tests

Every shared interface should have a small contract test suite.

Examples:

- every `StoryTransport` implementation passes transport contract tests;
- every AI provider passes provider adapter tests;
- every exporter accepts the same `ExportStory` fixture;
- every arc family validates against the same beat schema.

## 31.4 Integration rule

A feature is not “done” when its unit tests pass in isolation.

It is done when:

- it is merged against current main;
- integration tests pass;
- security review has no release-blocking issue;
- the single-file build still works.

---

# 32. Security Release Checklist

Before tagging the first public release, Agent 8 and Agent 0 should jointly verify:

- [ ] no private keys or API secrets in repository history or build artifact;
- [ ] no `eval`, `new Function`, or equivalent dynamic execution;
- [ ] no unsafe user-controlled `innerHTML` path;
- [ ] paste sanitization tested;
- [ ] link protocol allowlist tested;
- [ ] CSP present and restrictive;
- [ ] production build does not require remote JS/CSS CDN resources;
- [ ] protocol size limits enforced before expensive parsing;
- [ ] import size and schema validation enforced;
- [ ] AI prompts require explicit send action;
- [ ] API keys excluded from CRDT, IndexedDB project state, logs, and exports;
- [ ] dependency audit reviewed;
- [ ] malicious peer tests pass;
- [ ] malformed CRDT/protocol input fails safely;
- [ ] UI does not claim authentication/encryption unless transport reports it truthfully.

---

# 33. Final Engineering Note

The difficult part of this project is not generating 300 plot names.

The hardest engineering problems are:

- collaborative convergence;
- transport independence;
- preserving human control while procedural systems reshape structure;
- clean interoperable exports;
- avoiding false security assumptions in a static peer application;
- preventing collaborative, imported, or AI-generated content from becoming executable browser content.

Optimize the architecture around those problems first.
