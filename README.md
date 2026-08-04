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

On top of that it gives you **per-channel depth control** (plain outgoing links,
embedded notes and incoming links each get their own reach) right in the view, and **pinned central
notes** so you can
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
4. Run the **Open vicinity graph in right sidebar** command (see
   [Where the graph opens](#where-the-graph-opens)).

### BRAT

Use the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin ("Beta
Reviewers Auto-update Tool") to install directly from this repository and receive
pre-release updates. Add this repo as a beta plugin in BRAT, then enable
**Vicinity Graph** as above.

Requires Obsidian **1.12.4** or newer (see [minAppVersion](#minappversion-manifestjson)).

## Where the graph opens

Two commands, both bindable to a hotkey:

| Command | Places the graph |
|---|---|
| **Open vicinity graph in right sidebar** | docked in the right sidebar |
| **Open vicinity graph below active note** | in a main-area pane split **below** the current tab |

There is only ever **one** graph view: running either command while the graph is
open somewhere else **moves** it there. Running the command for where it already
is just focuses it — no rebuild.

## Interacting with the graph

- **Click a node** — the node becomes the graph's **central** note, and its
  markdown opens in the **current tab** (the last-used main-area tab is reused —
  never a new one).
- **Ctrl/Cmd-click a node** — opens the note itself, in a **new tab**. (Same
  modifier convention as outline entries and Obsidian links generally.)
- **Click an edge** — opens the **link preview** drawer scoped to **that edge
  only**: the occurrences of links from its source note to its target note,
  each expandable to its surrounding context with a **GO** button that jumps
  the editor to that exact line.
- **Hover a node** — nothing pops up. The node already shows its own outline or
  thumbnail, so the graph stays readable while the pointer crosses it.
- **Drag a node's right edge, bottom edge or bottom-right corner** — resizes
  that note's box (see *Node size*). The handles appear on hover.
- **Right-click a node** — pin / unpin, plus *Reset size* on a note you have
  resized (see *Pinning* and *Node size*).
- Folder-group boxes are containers, not notes — clicking one does nothing.

## Settings model

**Every setting is global — one value, used by every note and every open graph.**
There are no per-note settings: the two things the plugin does remember per note
— which notes are **pinned** and which you have **resized** — are not settings
but facts about that note, recorded when you act on it and applied in every
graph. Two surfaces edit the same values: the settings
tab (**Settings → Vicinity Graph**) and the in-view **Graph controls** panel;
changing either writes the one global value and refreshes every open graph.

**Both surfaces show the same sections, in the same order, under the same names**
— *Depth*, *Edges*, *Node sizing*, *Node contents*, *Force layout*,
*Node exclusion*, *Performance*. Every setting appears on both. The panel is narrow, so
it uses compact controls (steppers instead of sliders for depth) and moves the
long descriptions into hover tooltips. One deliberate exception: exclusion
**patterns** are *edited* in the settings tab and shown **read-only** in the
panel, because a multi-line regex list needs the room.

Controls answer immediately: a stepper, slider, toggle or typed field moves as you
use it, while the graph redraws behind it. Edits made in quick succession — even
across the two surfaces at once — each keep their own field; nothing you just
changed gets reverted by the next change.

### The settings

- **Depth** — how far traversal reaches from each central note, with a separate
  budget per kind of relationship *and per role*: one trio of dials for the
  **active note**, a second trio for **pinned notes**. Also on the controls
  panel, as `−` / `+` steppers under the same heading.
    - **Links out** — hops of plain outgoing links (`[[note]]`, `[note](note.md)`).
    - **Embeds out** — hops of *embedded* notes (`![[note]]`, and canvas cards that
      hold a note). Images and other attachments are unaffected: they are
      attachments however you write them, and never become nodes.
    - **Links in** — hops of incoming links. Kind-blind: a note that *embeds* the
      central note arrives here like any other linker; there is no "embedded in"
      budget.
    - **Pinned links out / Pinned embeds out / Pinned links in** — the same three
      budgets, applied to every *pinned* central instead. A pinned note that is
      also the active note uses the active-note trio.

  **Global, per role — never per note:** each trio applies to every note in that
  role, so nudging a dial changes every graph, not just the one in front of you.
  There is still no per-note depth dial.

  > Note on how the two outgoing budgets combine: each is walked independently,
  > so a chain that changes kind partway (a note you *embed*, which then *links*
  > something else) stops at the change. At the shipped defaults (1 hop each) you
  > will never see this; it only shows up once you raise a budget above 1.
- **Edges → Show cross links** (default **off**) — off, a line is drawn only where
  traversal actually followed a link, which keeps the picture close to the path
  from your central notes. On, the graph *also* draws every link between two notes
  that are both on screen — including the ones traversal never walked, such as two
  notes sitting at the edge of the depth budget that link each other. **Which
  notes are shown never changes**, only the lines between them; a cross link looks
  exactly like any other line, `xN` count included.
- **Sizing** — which metrics drive node size (own file size is the only one on by
  default) and their weights. One exception to pure score-driven size: a note that
  has an image is never sized below the height at which its thumbnail is shown in
  full (122px) — capped by your **max size**, so an explicit maximum still wins
  (set max below 122 and thumbnails stay hidden).
- **Preview** — a three-way pill choosing what a node shows in its preview slot:
  **Auto** (default), **Outline** or **Image**. See *Node contents* below. The
  same pill is in the in-view graph controls, under *Node contents* — both edit
  the one global value.
- **Outline depth** — how many markdown heading levels a node's outline shows
  (**1–6**, default **2**: sections plus subsections, which is what fits a node).
  Also in the controls panel, under *Node contents* beside the *Preview* pill. See
  *Node contents* below. The depth itself has no on/off switch — use the *Preview*
  pill to choose outline vs image.
- **Grouping** and the **node cap** (default **100** — above roughly a hundred
  nodes a graph stops being readable, so the view truncates deterministically and
  shows a hidden-node count). The cap is also in the controls panel, under
  *Performance*.
- **Force layout** — four sliders named like Obsidian's native graph (**Center
  force**, **Repel force**, **Link force**, **Link distance**) plus an *Advanced
  spacing* group (**Node spacing**, **Group member spacing** — the gap between
  notes *inside* one folder group, nothing else, and **Edge clearance** — how far
  a connecting line stays off the boxes it bends around). Changes
  re-layout open graphs immediately; ranges are clamped so no combination can
  degenerate the layout, and a **Restore defaults** button resets them all.
- **Typed fields settle before they apply** — the numeric and text fields (sizing
  numbers, node cap, exclusion patterns) wait for a short pause in typing, so
  entering `160` re-builds open graphs once instead of once per digit. Leaving a
  field, or closing the tab, applies it immediately — nothing you typed is lost. A
  value the plugin cannot accept (a **maximum node size below the minimum**) stays
  in the field with the reason beside it, rather than being silently saved, and a
  sizing number outside its allowed range says what will be stored instead of it.
- **Restoring defaults** — every section ends with its own restore row whose name
  states exactly what it resets (*Restore node sizing defaults*, *Restore force
  layout defaults*, …). Rows that only reset numeric knobs apply immediately;
  *Restore node exclusion defaults* asks first and lists the patterns it is about
  to delete, since those are hand-written and cannot be recovered. At the very
  bottom, **Restore all Vicinity Graph settings** resets every setting on the tab
  and asks for confirmation first. **Your pinned notes are never touched by any
  of them.**

### Pinning

- **Pinning a note makes it an extra central node.** Its vicinity is
  traversed and rendered alongside your active note's. You pin/unpin from a node's
  hover button or its right-click menu.
- **The active (central) note is pinnable too** — pin it before navigating away
  and it stays in the graph as a pinned central.
- The **pinned set is global state and survives restarts** (stored in the
  plugin's `data.json`). Pins are keyed by a stable note id, so renaming or moving
  a pinned note keeps it pinned.
- **Pinned centrals traverse with their own global depth trio** (the *Pinned
  links out / Pinned embeds out / Pinned links in* dials) — shared by every
  pinned note; there is still no per-pin depth dial. A pinned note that is also
  the active note uses the active-note depths.

> Known caveat: right after an Obsidian restart, a persisted pinned central can
> briefly render as a regular node (no pinned accent) until the background cleanup
> sweep runs (~15s). The pin is **not lost** — only its visual identity lags.
> Tracked in
> `docs-internal/tickets/ticket-pinned-central-status-lags-after-restart.md`.

### Node size

- **Drag any node bigger or smaller.** Hovering a node reveals a grab line on
  its right and bottom edges and a handle at the bottom-right corner; the new
  box is saved when you **release**, not while you drag.
- **The graph only re-arranges itself if it has to.** If the new box still has
  room where the note sits, everything stays exactly where it was. If it would
  sit on top of a neighbour or hang out of its folder group, the graph re-lays
  out around it on release. Nothing moves while you are still dragging.
- **A resized note keeps that size everywhere** — it is remembered per note
  (like a pin, keyed by a stable note id, so renames and moves keep it) and
  applies in every graph the note appears in, across restarts.
- **A size you set wins over the *Node sizing* dials** — including the min/max
  range and the width the title would ask for. Only sanity bounds (24–1200 px)
  still apply.
- **"Reset size"** in the node's right-click menu puts the note back on the
  computed size. The entry only appears on a note you have resized.
- Only the right/bottom/corner grips exist: dragging a top or left edge would
  move the node, and positions come from the layout, so it would snap back.

> Known caveat: when the release DOES re-run the layout, it also re-fits the
> viewport — the graph re-zooms and re-pans instead of staying where you had it.
> (A resize that fits keeps both the layout and your framing.)
> Nothing is lost, only your framing. Tracked in
> `_tickets/view-releasing-a-drag-resize-refits-the-viewport-relayout-bumps-layoutversion.md`.

### Node exclusion

Keep whole classes of notes out of every graph — index/MOC hubs, templates, a
`rel/` relationship folder — via a **global** exclusion pattern list.

- **Pattern list** lives in Settings → Vicinity Graph (one pattern per line) and
  is global, like every other setting. Its row is always on screen: while
  *Exclude notes from the graph* is off the box is **disabled**, not hidden, so you
  can still see what is stored — and switching exclusion back on brings those exact
  patterns straight back.
- **Controls panel** has the same *Exclude notes from the graph* switch, plus the
  patterns read-only; when exclusion is on and the current graph actually dropped
  notes, its section header shows an **excluded count** for that graph.
- **Matching is regex-lite.** Each line is a JavaScript regex tested
  **unanchored** and **case-sensitively** against the full vault-relative path
  **including extension**. So `rel/` matches `rel/some-relationship.md` (and
  `rel/` anywhere in the path), while `^rel/` anchors it to the vault root. A
  line that is not a valid regex still never breaks the graph (it excludes
  nothing) — and the settings tab now names it, with its line number, right under
  the box, instead of ignoring it silently.
- **Only discovered neighbors are excluded** — the active note and pinned
  centrals stay even if they match a pattern. Excluded notes are pruned at the
  data layer (during traversal, before rendering), so a note reachable *only*
  through an excluded note is not discovered either.

### Node contents

A node tall enough to have room shows **one** preview: either the note's
**heading outline** or its **first image**, never both.

- **The *Preview* pill picks which one**, globally. It lives in **Settings →
  Vicinity Graph → Node contents** *and* in the in-view graph controls under
  *Node contents*; the two are one setting shown twice, so either writes both.
  - **Auto** (the default, and what the plugin has always done) — **document
    position decides.** If the note's first image sits **before** its first
    heading, the node shows the **image**; otherwise it shows the **outline**.
    That is the escape hatch: move the image above the first heading to say
    "show the picture for this note", and it still works exactly as before.
  - **Outline** — prefer the outline for every note that has headings, whatever
    document position says.
  - **Image** — prefer the first image for every note that has one.
- **A preference never empties a node.** *Outline* on a note without headings
  still shows its image; *Image* on a note without an image still shows its
  outline. A node only goes preview-less when the note has neither.
- The outline is a **nested list** capped by the *Outline depth* setting. It
  scrolls when it does not fit (the scrollbar appears on hover); an over-long
  entry ellipsises on its own, and its full text is in the tooltip.
- **Clicking an entry opens the note at that heading** (ctrl/cmd-click opens it
  in a new tab).

## V1 scope / limits

- **LOCAL graph only.** No global graph.
- **No unresolved (ghost) links.**
- **Every setting is global**, including sizing. The one per-note exception is
  the size you set by dragging a node (see *Node size*); per-view overrides come
  later, if at all.
- **No manual node dragging persistence; layout is computed.**
- Default **node cap is 100** (the readable ceiling).
- **Canvas text-node links count** — `[[wikilinks]]` and markdown-style
  `[a](note.md)` alike — but a link written inside a **code span** in a canvas
  text node may still produce an edge Obsidian itself would not draw.
- **Outline entries jump to the FIRST heading with that text** — same as any
  `[[Note#Heading]]` link in Obsidian, so duplicate headings are ambiguous.
- **`*.excalidraw.md` drawings show no outline** (they stay graph nodes; their
  body is a generated payload, not prose). Canvas files have no headings at all.
- **Heading display strips common inline markdown** (`[[links]]`, `**bold**`,
  `` `code` ``, `[md](links)`) but is not a markdown renderer — underscore
  emphasis, escapes and exotic nesting can leave a stray character in the label.
  The link never depends on it: the raw heading text is what opens the note.

## V2 roadmap (deferred)

- Per-view sizing overrides.
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
**Vicinity Graph**, and run the **Open vicinity graph in right sidebar** command.

`npm run setup:dev-vault` is idempotent: it creates `.dev-vault/` fixtures and a
minimal `.obsidian/` config (which auto-enables the plugin) only when missing, so
re-running never clobbers local edits.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | esbuild watch build; copies artifacts into the dev vault on every rebuild |
| `npm run build` | `npm run check`, then production bundle to `main.js` + dev-vault copy |
| `npm run check` | strict `tsc -noEmit` over `src/`, then `check:e2e` |
| `npm run check:e2e` | `tsc -noEmit -p e2e/tsconfig.json` (type-checks the e2e specs) |
| `npm test` | our vitest suite (`obsidian-id-lib` ships its own tested build from npm) |
| `npm run setup:dev-vault` | build + create/copy the plugin into `.dev-vault/` |
| `npm run test:e2e` | Playwright e2e: drives a REAL Obsidian on a copy of the dev vault (see below) |

### e2e suite (`npm run test:e2e`)

Launches a real Obsidian (Electron) on a throwaway COPY of `.dev-vault` (plus
e2e-only `crowd/` fixtures) with a sandboxed `--user-data-dir`, and asserts
rendered DOM state (node counts, tier classes, badges, edge markers,
theme-reactive arrowheads). It is separate from `npm test` (which never launches
Obsidian), but it is **not release-only**: it is the only suite that exercises
the real rendered plugin, so run it while developing any change to the view
layer, the settings tab, or graph behavior — and again as a release gate.

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

In its default mode the suite is idempotent (fresh vault copy + fresh sandbox
config per run under `.tmp/e2e/`) and never touches your real Obsidian config or
the dev-vault fixtures.

#### Driving your own vault (`VICINITY_E2E_VAULT`) — opt-in

To reproduce "the graph looks wrong in MY vault", point the harness at that
vault. It is then opened **in place** — no copy, no wipe, no fixture writes — and
the `externalVault.e2e.ts` spec centres the graph on one note and screenshots it
to `.out/external-vault-graph.png`:

```bash
# one-time: install the plugin into the target vault (symlinks track your builds)
npm run build
VAULT=/path/to/vault
mkdir -p "$VAULT/.obsidian/plugins/vicinity-graph"
for f in main.js manifest.json styles.css; do
  ln -sf "$PWD/$f" "$VAULT/.obsidian/plugins/vicinity-graph/$f"
done
# …then enable "Vicinity Graph" in that vault's Settings → Community plugins

VICINITY_E2E_VAULT="$VAULT" VICINITY_E2E_NOTE='some/note.md' \
  npm run test:e2e -- externalVault.e2e.ts
```

(Symlink the three artifacts, **not** the repo root as the plugin folder — with
the repo as the plugin dir, Obsidian writes that vault's plugin state
(`data.json`) into your checkout.)

`externalVault.e2e.ts` is the only spec that may run this way; every other spec
drives plugin settings (restore-defaults, exclusion patterns, pins) and
refuses to start against a real vault, as does passing e2e fixture notes. The
harness also refuses to install or enable the plugin for you — you enable it, and
we then only load what your vault already lists. Unset the variable and
everything above behaves exactly as before.

> ⚠️ **Caveat — use a scratch or backed-up vault. The run is not read-only.**
> The harness never deletes, copies over or writes files into the vault, but
> Obsidian and the plugins do:
> - Obsidian rewrites its own config in that vault (observed:
>   `.obsidian/workspace.json`, `.obsidian/core-plugins.json`).
>   `workspace.json` is rewritten because the graph opens in the right sidebar
>   and detaches the other sidebar leaves — and because the harness ends
>   Obsidian with a signal, it can be left **truncated to 0 bytes**, i.e. your
>   saved layout for that vault is lost.
> - The plugin writes its own `.obsidian/plugins/vicinity-graph/data.json`.
> - Turning on community plugins is required to load anything at all, so
>   **every community plugin enabled in that vault loads and runs** (Templater,
>   periodic notes, sync, …), each free to write to it — exactly as when you
>   open the vault yourself.

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
