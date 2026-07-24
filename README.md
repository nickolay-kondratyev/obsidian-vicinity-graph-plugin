# Vicinity Graph

An Obsidian plugin that renders the vicinity of your active note as a rich,
grouped, React Flow graph — meant to be used in place of the native local graph.

## What it is / Why

The native local graph has two core weaknesses: **every node looks the same, and
there is no grouping.** Every note is an identical dot, and you cannot see any
structure between them.

Vicinity Graph fixes both:

- **Informative nodes.** Each node carries its title, a first-image thumbnail,
  an icon strip for its attachments (with counts), its folder identity, and a
  size that reflects relevance. A node should tell you what the note is before
  you open it.
- **Folder grouping as visible structure.** Notes that share a folder render
  inside a labelled group box (at 2+ members), so folder membership is part of
  the picture instead of invisible metadata.

On top of that it gives you **per-direction, per-note depth control** (outbound
and incoming traversed independently) and **pinned central notes** so you can
hold one or more vicinities on screen while you browse elsewhere. The view
lives in the right sidebar by default (matching native local-graph muscle
memory) and can be dragged into the main area.

> Screenshots: TBD.

## Install

Vicinity Graph is **not yet in the Obsidian community plugin store.** Install
it one of two ways:

### Manual

1. Download `manifest.json`, `main.js`, and `styles.css` from a
   [GitHub Release](../../releases).
2. Copy all three into your vault at
   `.obsidian/plugins/vicinity-graph/` (create the folder if needed).
3. In Obsidian: **Settings → Community plugins**, enable community plugins, then
   enable **Vicinity Graph**.
4. Run the **Open vicinity graph** command.

### BRAT

Use the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin ("Beta
Reviewers Auto-update Tool") to install directly from this repository and receive
pre-release updates. Add this repo as a beta plugin in BRAT, then enable
**Vicinity Graph** as above.

Requires Obsidian **1.12.4** or newer (see [minAppVersion](#minappversion-manifestjson)).

## Settings model

There are two layers of settings: **global defaults** and **per-note overrides.**
The distinction matters because people ask about it, so it is worth reading once.

### Global defaults (Settings → Vicinity Graph)

- **Depth** — how far outbound/incoming traversal reaches from each central note.
- **Sizing** — which metrics drive node size (own file size is the only one on by
  default) and their weights. Sizing is **global-only in V1.**
- **Outline depth** — how many markdown heading levels a node's outline shows
  (**1–6**, default **2**: sections plus subsections, which is what fits a node).
  See *Node contents* below. There is no on/off switch.
- **Grouping** and the **node cap** (default **100** — above roughly a hundred
  nodes a graph stops being readable, so the view truncates deterministically and
  shows a hidden-node count).
- **Force layout** — four sliders named like Obsidian's native graph (**Center
  force**, **Repel force**, **Link force**, **Link distance**) plus an *Advanced
  spacing* group (**Node spacing**, **Group member spacing**). Changes re-layout
  open graphs immediately; ranges are clamped so no combination can degenerate
  the layout, and a **Restore defaults** button resets all six.

### Per-note depth overrides

Depth is the one thing you can tune per note, from the in-view toolbar:

- **Touching a depth control pins that choice for that note** — even if the value
  you set equals the current global default. This is deliberate: globals can
  change later, and a value you explicitly chose should not silently move with
  them. It is tracked **per field** (outbound vs incoming), not per note as a
  whole, and "reset to global" removes the override so it inherits again.

### Pinning

- **Pinning a note makes it an extra central node.** Its vicinity is
  traversed and rendered alongside your active note's. You pin/unpin from a node's
  hover button or its right-click menu.
- **The active (central) note is pinnable too** — pin it before navigating away
  and it stays in the graph as a pinned central.
- The **pinned set is global state and survives restarts** (stored in the
  plugin's `data.json`).
- **The subtle bit:** when you adjust a *pinned* central's depth while viewing
  note Y, that adjustment is saved inside **Y's own per-note data**, keyed by the
  pinned note's id — not in the pinned note's own settings. Returning to Y
  restores exactly that view; the pinned note's own saved depth is left untouched.

> Known caveat: right after an Obsidian restart, a persisted pinned central can
> briefly render as a regular node (no pinned accent, missing from the toolbar
> list) until the background cleanup sweep runs (~15s). The pin is **not lost** —
> only its visual identity lags. Tracked in
> `docs-internal/tickets/ticket-pinned-central-status-lags-after-restart.md`.

### Node exclusion

Keep whole classes of notes out of every graph — index/MOC hubs, templates, a
`rel/` relationship folder — via a **global** exclusion pattern list.

- **Pattern list** lives in Settings → Vicinity Graph (one pattern per line) and
  is global (like sizing and the node cap — no per-note override).
- **Toolbar pill** enables/disables exclusion in-view; when it is on and the
  current graph actually dropped notes, it shows an **excluded count** for that
  graph.
- **Matching is regex-lite.** Each line is a JavaScript regex tested
  **unanchored** and **case-sensitively** against the full vault-relative path
  **including extension**. So `rel/` matches `rel/some-relationship.md` (and
  `rel/` anywhere in the path), while `^rel/` anchors it to the vault root. An
  invalid pattern is silently ignored (it excludes nothing and never breaks the
  graph).
- **Only discovered neighbors are excluded** — the active note and pinned
  centrals stay even if they match a pattern. Excluded notes are pruned at the
  data layer (during traversal, before rendering), so a note reachable *only*
  through an excluded note is not discovered either.

### Node contents

A node tall enough to have room shows **one** preview: either the note's
**heading outline** or its **first image**, never both.

- **Which one you get is decided by document position.** If the note's first
  image sits **before** its first heading, the node shows the **image**;
  otherwise it shows the **outline**. That is the escape hatch — move the image
  above the first heading to say "show the picture for this note".
- The outline is a **nested list** capped by the *Outline depth* setting. It
  scrolls when it does not fit (the scrollbar appears on hover); an over-long
  entry ellipsises on its own, and its full text is in the tooltip.
- **Clicking an entry opens the note at that heading** (ctrl/cmd-click opens it
  in a new tab).

## V1 scope / limits

- **LOCAL graph only.** No global graph.
- **No unresolved (ghost) links.**
- **Sizing configuration is global only;** per-view sizing overrides come later.
- **No manual node dragging persistence; layout is computed.**
- Default **node cap is 100** (the readable ceiling); canvas text-node wikilinks
  are skipped.
- **Outline entries jump to the FIRST heading with that text** — same as any
  `[[Note#Heading]]` link in Obsidian, so duplicate headings are ambiguous.
- **`*.excalidraw.md` drawings show no outline** (they stay graph nodes; their
  body is a generated payload, not prose). Canvas files have no headings at all.
- **Heading display strips common inline markdown** (`[[links]]`, `**bold**`,
  `` `code` ``, `[md](links)`) but is not a markdown renderer — underscore
  emphasis, escapes and exotic nesting can leave a stray character in the label.
  The link never depends on it: the raw heading text is what opens the note.

## V2 roadmap (deferred)

- Per-view sizing overrides (the data format is already shaped for it).
- Position-seeded incremental layout.
- Canvas text-node wikilink parsing.
- Unresolved link ghost nodes (toggle, off by default).
- User-assignable folder colors.
- Manual node position persistence, if ever.

## Development

Fresh clone → running dev build, following only these steps:

```bash
npm install                   # pulls obsidian-id-lib from npm, among other deps
npm run setup:dev-vault       # build + create/copy the plugin into .dev-vault/
npm run dev                   # esbuild watch; re-copies artifacts on every rebuild
```

Then open `.dev-vault/` as a vault in Obsidian, enable community plugins, enable
**Vicinity Graph**, and run the **Open vicinity graph** command.

`npm run setup:dev-vault` is idempotent: it creates `.dev-vault/` fixtures and a
minimal `.obsidian/` config (which auto-enables the plugin) only when missing, so
re-running never clobbers local edits.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | esbuild watch build; copies artifacts into the dev vault on every rebuild |
| `npm run build` | `tsc -noEmit` type check, then production bundle to `main.js` + dev-vault copy |
| `npm run check` | `tsc -noEmit` (strict type check) |
| `npm test` | our vitest suite (`obsidian-id-lib` ships its own tested build from npm) |
| `npm run setup:dev-vault` | build + create/copy the plugin into `.dev-vault/` |
| `npm run test:e2e` | release-time Playwright e2e: drives a REAL Obsidian on a copy of the dev vault (see below) |

### e2e suite (`npm run test:e2e`)

Launches a real Obsidian (Electron) on a throwaway COPY of `.dev-vault` (plus
e2e-only `crowd/` fixtures) with a sandboxed `--user-data-dir`, and asserts
rendered DOM state (node counts, tier classes, badges, edge markers,
theme-reactive arrowheads). It is a release gate, not part of `npm test`.

On **Linux / Docker / CI it just runs** — no setup:

```bash
npm run test:e2e
```

`scripts/run-e2e.sh` (the `test:e2e` entry) makes it self-contained:

- **Binary:** when `OBSIDIAN_PATH` is unset it auto-downloads a pinned Obsidian
  build once (the Linux tarball — no FUSE/AppImage extraction), caches it under
  `.tmp/obsidian/`, and points the suite at it (`scripts/setup-obsidian-bin.sh`;
  also `npm run setup:obsidian`). Bump the pinned `OBSIDIAN_VERSION` in that
  script deliberately.
- **Display:** when no display server is detected (`$DISPLAY`/`$WAYLAND_DISPLAY`
  unset), it defaults the headless Chromium-Ozone flags
  (`--ozone-platform=headless --disable-gpu`) so Electron boots offscreen instead
  of dying on a missing X server.

Both are overridable — set `OBSIDIAN_PATH` and/or `OBSIDIAN_E2E_EXTRA_ARGS`
yourself and the script leaves them untouched. `OBSIDIAN_PATH` is **required** on
macOS/Windows (no drop-in binary to auto-provision), e.g.:

```bash
# macOS
export OBSIDIAN_PATH='/Applications/Obsidian.app/Contents/MacOS/Obsidian'
npm run test:e2e
```

The suite is idempotent (fresh vault copy + fresh sandbox config per run under
`.tmp/e2e/`) and never touches your real Obsidian config or the dev-vault
fixtures.

### `minAppVersion` (manifest.json)

`1.12.4` — the first public Obsidian release with core canvas backlink/graph link
indexing
([1.12 changelog](https://obsidian.md/changelog/2026-02-10-desktop-v1.12.0/)). It
is a floor, never a ceiling: newer Obsidian versions must keep working. Note:
canvas `metadata.frontmatter` (used by `obsidian-id-lib` for canvas doc ids) was
not introduced by any core release — it relies on the canvas format's documented
arbitrary-key forward compatibility.

### Dependency: `obsidian-id-lib`

Consumed as a published npm package (`"obsidian-id-lib": "^0.1.0"`) and bundled
into `main.js` by our esbuild (not external). `obsidian` itself is a types-only
external and is never bundled. See the [package](https://www.npmjs.com/package/obsidian-id-lib)
for the id-scheme contracts.

## License

Vicinity Graph is **source-available** under the **Kondratyev Source Available
License, Version 2.3 (KSAL-2.3)** — not an OSI open-source license. See
[`LICENSE.md`](./LICENSE.md), which is the authoritative and controlling text.
