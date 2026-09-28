# StoryWeave

Cooperative storytelling in a single static HTML file. Prompt each other with creative
questions, grow a story bible from the answers, pick one of 300 plot structures, and
write together in turns inside a live shared editor. Export to `.txt`, `.md`, or `.docx`.

There's no server and no account. It runs on GitHub Pages.

## How rooms work

- **Every visit to the bare URL creates a fresh private story** with a random 128-bit
  token in the URL fragment: `https://you.github.io/storyweave/#uXhX8T8oYfu9lvd6J8J00A`.
- **Share that link to collaborate.** Anyone with it can read and edit. There is no public
  directory of rooms.
- The fragment (after `#`) is never sent to any server. Public Nostr relays only see a
  SHA-256-derived room id and help browsers find each other (via [Trystero](https://github.com/dmotz/trystero),
  as in c4-man). The token is also the password that encrypts the WebRTC signaling, so a
  peer without the link can't complete a handshake.
- Story data flows browser-to-browser over DTLS-encrypted WebRTC data channels, and
  is saved in each participant's IndexedDB. Tabs in the same browser also sync over
  `BroadcastChannel`, which works offline.
- Names are labels, not verified identities. Turn order and "who answers which prompt" are
  friendly conventions, not permissions.

## Features

| Area | What's there |
| --- | --- |
| Prompt Relay | 94 templates across 8 categories; 4–48 per deal (presets 6/12/20/32/48); round-robin, cross-room, seeded-shuffle, or manual assignment; senders can tailor questions before answering |
| Story Bible | Answers grouped into 12 sections with links back to their source prompts; shared character/relationship cards |
| Plot Engine | 15 arc families × 5 conflict lenses × 4 narrative shapes = 300 plot lines; search, filters, seeded/new random, favourites, side-by-side compare, copy outline; answers are slotted into each of 12 beats deterministically |
| Campbell | Every beat maps to stages of Joseph Campbell's monomyth (*The Hero with a Thousand Faces*), with a hover tooltip, a summary, and prompts you can cycle, send to a collaborator as a prompt, or drop into the scratchpad |
| Write | ProseMirror + Yjs live editor with remote cursors, turn-based composer (1–5 sentence soft target), beat targeting, anchored comments, per-user undo, focus mode |
| Spark | Seeded oracle, motif, constraint, and complication draws, shared with the room |
| AI Assist | Optional BYOK: Claude via the Anthropic SDK (default `claude-opus-5`), or any OpenAI-compatible endpoint including local models. Every request shows a preview and needs confirmation, and output is never inserted automatically |
| Export | `.docx` (valid OOXML), `.md`, `.txt`, full project backup/restore, duplicate as new story |

## Develop

```sh
npm ci
npm run dev        # http://localhost:5173 (open two tabs to collaborate with yourself)
npm test           # unit tests (vitest)
npm run build      # dist/index.html — the whole app, one file, CSP injected
npm run test:e2e   # Playwright multi-tab tests against the build
P2P=1 npm run test:e2e   # also test real WebRTC sync between isolated browser profiles
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main`. `.github/workflows/pages.yml` tests, builds, and deploys `dist/`.

## Architecture

```
src/
  collaboration/  room token → room id, wire protocol, transports, sync engine, CRDT schema
  persistence/    IndexedDB per room
  prompts/        template library + deterministic dealing/assignment
  story-engine/   arc families, lenses, shapes, Campbell stages, outline builder, bible, spark tools
  editor/         ProseMirror schema + editor (y-prosemirror)
  export/         normalised export model, txt/md/docx, backup
  ai/             provider adapters (Anthropic SDK, OpenAI-compatible)
  ui/             app shell + views (vanilla DOM; untrusted text only via textContent)
```

**Transport independence.** Story code talks to `SyncEngine`, which speaks a versioned
binary envelope (`HELLO`/`STATE_DIFF`/`YJS_UPDATE`/`AWARENESS`/…) over any `StoryTransport`.
To carry traffic over your own network:

```js
storyweave.setTransport(new storyweave.ExternalStoryTransport({
  send: bytes => myNetwork.send(bytes),            // or strings with stringsOnly: true
  subscribe: cb => myNetwork.onMessage(cb),        // cb(bytes, fromPeerId)
}))
```

**Determinism.** All generation uses a seeded PRNG (`src/util/rng.js`) with named sub-seeds
(`<seed>/prompts/…`, `<seed>/beat/…`, `<seed>/oracle/<n>`). The default seed is derived from
the room token, so every peer agrees even before syncing.

**Security.** The threat model and controls follow `plan.md` §18–19. Frames are size-capped,
room-tagged, and rate-limited per peer, and malformed CRDT or awareness data is dropped. Peer
names and colours are sanitised. The editor schema discards pasted HTML it doesn't know. The
build injects a hash-based CSP and refuses to ship external scripts. Imports are validated
and always open as a new room. API keys never enter shared state, IndexedDB, backups, or URLs.

**Known limits.** Browsers on very strict NATs may need a TURN server to connect directly
(`TrysteroTransport` accepts one). `style-src 'unsafe-inline'` is required because the
editor's remote-cursor decorations use inline styles. Local in-browser AI models are not
bundled.
