# Neighborhood Graph

An Obsidian plugin that renders the neighborhood of your active note as a rich,
grouped, React Flow graph — meant to be used in place of the native local graph.

## What it is / Why

The native local graph has two core weaknesses: **every node looks the same, and
there is no grouping.** Every note is an identical dot, and you cannot see any
structure between them.

Neighborhood Graph fixes both:

- **Informative nodes.** Each node carries its title, a first-image thumbnail,
  an icon strip for its attachments (with counts), its folder identity, and a
  size that reflects relevance. A node should tell you what the note is before
  you open it.
- **Folder grouping as visible structure.** Notes that share a folder render
  inside a labelled group box (at 2+ members), so folder membership is part of
  the picture instead of invisible metadata.

On top of that it gives you **per-direction, per-note depth control** (outbound
and incoming traversed independently) and **pinned central notes** so you can
hold one or more neighborhoods on screen while you browse elsewhere. The view
lives in the right sidebar by default (matching native local-graph muscle
memory) and can be dragged into the main area.

> Screenshots: TBD.

## Install

Neighborhood Graph is **not yet in the Obsidian community plugin store.** Install
it one of two ways:

### Manual

1. Download `manifest.json`, `main.js`, and `styles.css` from a
   [GitHub Release](../../releases).
2. Copy all three into your vault at
   `.obsidian/plugins/obsidian-neighborhood-graph/` (create the folder if needed).
3. In Obsidian: **Settings → Community plugins**, enable community plugins, then
   enable **Neighborhood Graph**.
4. Run the **Open neighborhood graph** command.

### BRAT

Use the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin ("Beta
Reviewers Auto-update Tool") to install directly from this repository and receive
pre-release updates. Add this repo as a beta plugin in BRAT, then enable
**Neighborhood Graph** as above.

Requires Obsidian **1.12.4** or newer (see [minAppVersion](#minappversion-manifestjson)).

## Settings model

There are two layers of settings: **global defaults** and **per-note overrides.**
The distinction matters because people ask about it, so it is worth reading once.

### Global defaults (Settings → Neighborhood Graph)

- **Depth** — how far outbound/incoming traversal reaches from each central note.
- **Sizing** — which metrics drive node size (own file size is the only one on by
  default) and their weights. Sizing is **global-only in V1.**
- **Grouping** and the **node cap** (default **100** — above roughly a hundred
  nodes a graph stops being readable, so the view truncates deterministically and
  shows a hidden-node count).

### Per-note depth overrides

Depth is the one thing you can tune per note, from the in-view toolbar:

- **Touching a depth control pins that choice for that note** — even if the value
  you set equals the current global default. This is deliberate: globals can
  change later, and a value you explicitly chose should not silently move with
  them. It is tracked **per field** (outbound vs incoming), not per note as a
  whole, and "reset to global" removes the override so it inherits again.

### Pinning

- **Pinning a note makes it an extra central node.** Its neighborhood is
  traversed and rendered alongside your active note's. You pin/unpin from a node's
  hover button or its right-click menu.
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

## V1 scope / limits

- **LOCAL graph only.** No global graph.
- **No unresolved (ghost) links.**
- **Sizing configuration is global only;** per-view sizing overrides come later.
- **No manual node dragging persistence; layout is computed.**
- Default **node cap is 100** (the readable ceiling); canvas text-node wikilinks
  are skipped.

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
git submodule update --init   # pull the obsidian-id-lib submodule
npm install
npm run setup:dev-vault       # build + create/copy the plugin into .dev-vault/
npm run dev                   # esbuild watch; re-copies artifacts on every rebuild
```

Then open `.dev-vault/` as a vault in Obsidian, enable community plugins, enable
**Neighborhood Graph**, and run the **Open neighborhood graph** command.

`npm run setup:dev-vault` is idempotent: it creates `.dev-vault/` fixtures and a
minimal `.obsidian/` config (which auto-enables the plugin) only when missing, so
re-running never clobbers local edits.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | esbuild watch build; copies artifacts into the dev vault on every rebuild |
| `npm run build` | `tsc -noEmit` type check, then production bundle to `main.js` + dev-vault copy |
| `npm run check` | `tsc -noEmit` (strict type check) |
| `npm test` | our vitest suite, then the `obsidian-id-lib` submodule's own suite (`test:sublib`) |
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

### Submodule: `obsidian-id-lib`

Consumed as `"obsidian-id-lib": "file:submodules/obsidian-id-lib"` — raw
TypeScript bundled by our esbuild (no build step in the submodule). `obsidian`
itself is a types-only external and is never bundled. See the submodule README for
the id-scheme contracts.

## License

Neighborhood Graph is **source-available** under the **Kondratyev Source Available
License, Version 2.3 (KSAL-2.3)** — not an OSI open-source license. See
[`LICENSE.md`](./LICENSE.md), which is the authoritative and controlling text.
