# Local Graph Plugin: High-Level Plan

An Obsidian plugin that replaces the local graph view with a React Flow based view. It exists to fix the two core weaknesses of the native graph: every node looks the same, and there is no grouping. Nodes become rich, informative components grouped by folder, sized by configurable metrics, traversed with per-direction depth control.

## Goals

1. **Nodes that carry information.** Title, first image thumbnail, attachment icons, folder identity, visual emphasis by relevance. A node should tell you what the note is before you open it.
2. **Grouping by folder.** Folder membership is visible structure in the graph, not invisible metadata.
3. **Directional, per-node depth control.** Outbound and incoming depth are independent, adjustable in the view, and remembered per document.
4. **Pinned central nodes.** Hold one or more vicinities on screen while browsing elsewhere.
5. **Focused, bounded views.** Hard node cap with deterministic truncation. Above ~100 nodes a graph stops being interesting; we optimize for the readable range instead of chasing scale.
6. **Feels native.** Obsidian theme variables, native hover previews, sidebar placement, canvas support.

## Scope: V1

- **LOCAL graph only.** No global graph.
- No unresolved (ghost) links.
- Sizing configuration is global only; per-view sizing overrides come later once the data format settles.
- No manual node dragging persistence; layout is computed.

## Terminology

- **MAIN**: the node whose editor is currently active.
- **Central nodes**: MAIN plus every pinned node. Centrals are traversal roots.

## Decisions

### Stack

- **React Flow** for rendering. Chosen because custom nodes are React components (rich node content is the core requirement) and subflows provide native grouping. Accepted tradeoff: no built-in layout, DOM-based rendering caps practical size at a few hundred nodes, which the node cap makes irrelevant.
- **elkjs** for layout. It is the layout engine that understands hierarchical containment, so folder groups lay out correctly. Dagre does not handle compound layout; do not spend time on it.
- **TypeScript + esbuild** standard plugin toolchain, **React 18** mounted in an ItemView, **vitest** for the pure layers.
- **docid library** lives as a git submodule at `submodules/obsidian-id-lib`. Its README is the source of truth for id creation and usage.
- `minAppVersion` set to the Obsidian version that introduced canvas `metadata.frontmatter`, which the id scheme depends on.

### Graph model and traversal

- Traverse on demand at graph build time via the Obsidian API. **No persistent link cache of our own**, so no cache invalidation. Obsidian maintains the indexes.
- Outgoing links from `resolvedLinks`; incoming links via `getBacklinksForFile` per visited node. Per-node lookup scales with nodes visited (bounded by the cap), not vault size, and delegates index maintenance to Obsidian.
- **Multi-root directional BFS**: independent BFS per central node, outbound and incoming traversed separately with independent depth limits, results unioned and deduped.
- Each root traverses with **its own depth settings** (per-root, no cascade for depth). Node X pinned at depth 3 keeps exploring at depth 3 while MAIN Y explores at depth 1.
- Every node is tagged with depth per root per direction; **minDepth** = minimum across all roots and directions drives sizing decay and truncation priority.
- **Non-markdown files are never graph nodes.** They are collected as node content (attachments) during traversal.
- **Global node exclusion**: a global (not per-doc) list of regex-lite patterns matched against each candidate's vault-relative path prunes matching neighbors **at BFS discovery** (before metadata reads / edge recording / expansion). Central and pinned roots are exempt even when they match; a node reachable only through an excluded node is not discovered. The count of distinct excluded paths is surfaced in the view.
- Rebuild triggers: active file change, plus vault file changes while the view is open (debounced metadata resolve, ~500ms).

### Node cap and truncation

- Hard cap on visible nodes, **a setting, default 100**.
- **All central nodes are exempt** from the cap. Folder group containers do not count toward it.
- Deterministic truncation priority chain: lower minDepth wins, then higher size score, then graph distance to MAIN when connected, then pin recency (most recent wins), then docid as final tiebreaker. The same chain resolves multi-pin conflicts in the settings cascade.
- Truncation is surfaced in the UI: hidden-node count, ideally per folder group.

### Sizing

- Composable metric system. Each metric is independently normalized (log or sqrt scale for byte sizes so one huge note does not dwarf everything), toggled, and weighted; the composed score maps to a min/max pixel range.
- Metrics: **own-file-size** (the default and the only one enabled out of the box), total-linker-size, backlink-count, outlink-count, and **depth-decay** (multiplier `1 / (1 + k * depth)` using shortest depth from any central, so nearby notes stay prominent even at high depth settings).
- Sizing controls live behind an expandable section, not front and center.
- **Pinned nodes get central-node sizing even when disconnected** from MAIN.
- The composed score drives a node's **height**; its **width** snugly fits the title on one line — floored at the score-driven square and **capped** at `NODE_MAX_LABEL_WIDTH_PX` (~250px). A title longer than the cap stops widening the node and **wraps onto the 4 lines** the title CSS allows (`-webkit-line-clamp: 4`, tightened to 2 when a thumbnail shares the node — see below), rather than ellipsizing. The width is a pure char-count estimate in the view mapping (`nodeDimensionsPx`) — no DOM measuring.
- **A node that HAS an image is floored at the thumbnail-visibility height** (`THUMBNAIL_VISIBLE_MIN_NODE_PX` = 122px), so a low-relevance note never renders an image it is too short to show. The floor is capped by the user's `maxPx` (an explicit maximum is never overruled) and only ever grows a node. It keys off the stable fact `firstImagePath !== undefined`, NOT the resolved preview kind — see the preference-independence rule under Rendering. It moves `sizePx` only, never `sizeScore`, which stays pure relevance because it also ranks truncation.
	- **The CSS density thresholds below are CONTENT-box heights, not node heights** — a size container query measures the container's content box, which is `sizePx` minus the node's border + padding (18px). So the 104px thumbnail threshold is 122px of node, and the engine constant is composed as `104 + 18`; `thumbnailDensityThreshold.test.ts` re-derives both halves from the stylesheet. Confusing the two is what made an earlier version of this floor a no-op.
	- At exactly that floor the thumbnail slot is shown **whole**, not clipped: the reveal block caps the title at the 2 lines the 104px budget allots (the title is `flex-shrink: 0`, so an unclamped long title would otherwise push the 56px slot out through `overflow: hidden`). Budgeting the title in CSS — rather than inflating the floor to ~150px to survive a 4-line title — keeps image-heavy vicinities from ballooning.
- Sizing is global-only in V1.

### Pinning and settings resolution

- Pinning a node makes it an **extra central node**: its vicinity is traversed and rendered alongside MAIN's. The pinned set is global state and survives restarts.
- Settings split into two classes:
    - **Traversal settings (depth)**: per-root. Each central resolves own doc override, falling back to global default.
    - **View settings (sizing, grouping, cap)**: one per view. Cascade: MAIN's overrides on top, pinned nodes fill per-field gaps (conflicts resolved by the priority chain), global underneath. In V1 this cascade has little to arbitrate since sizing is global, but the resolver ships with tests because per-view overrides are planned.
- **Adjusting a pinned central's depth while at MAIN Y persists inside Y's doc file** (a `centralDepths` map keyed by docid). Returning to Y as MAIN restores the exact view. X's own saved setting is untouched.
- **Pin-on-toggle**: any explicit user change in the view writes a per-doc entry, even when the value matches the current global default, because globals can change later. Absence of a field means inherit; presence means pinned. Per-field, not per-document: touching one setting does not snapshot the rest.
- The UI needs reset-to-global (unpin) affordances per control, plus unpin controls on pinned nodes themselves. Pinned centrals are styled distinctly from MAIN.

### Persistence

- All storage is **JSON**.
- Global settings and the pinned set: `data.json` via `saveData`/`loadData`.
- Per-document settings: **one file per doc at `.obsidian/plugins/<id>/doc-data/<docid>.json`**, written via `vault.adapter.write`. Chosen over a single data.json blob because hundreds of entries are feasible and per-doc files are sync-friendly (a change to doc A never rewrites doc B's entry, no merge conflicts across devices).
- **docid is a stable unique id** from the submodule library. Markdown docs: frontmatter. Canvas docs: Obsidian's native canvas `metadata.frontmatter`, which survives canvas edits. Stable ids make renames a non-event.
- Deletes: `vault.on('delete')` plus an in-memory path-to-docid map for live cleanup, and an **orphan sweep** for everything else. The sweep validates doc-data files, pinned docids, and `centralDepths` entries, dropping anything whose doc no longer resolves.
- Sweep constraints: **delayed start (~15s after plugin load)** so it never competes with startup, and **chunked with yields** (process a batch, `await sleep(0)`, continue) since async alone does not protect the single-threaded main loop.
- Every persisted shape carries a `version` field from day one.

### Canvas support

- Canvases are first-class docs: they can be nodes, centrals, and pinned.
- **We prefer not to own canvas parsing.** Adaptive strategy, decided **per canvas** at build time: if `resolvedLinks` holds that canvas's own key, its edges flow through the same code path as markdown and our parser never runs for it; otherwise the fallback parses that canvas's JSON. Per canvas and not per install because Obsidian indexes canvases one file at a time and can leave one indefinitely unindexed — a vault-wide verdict would leave every canvas on the wrong side of a partial index with NO link source at all. Presence of the key is the test, since an indexed but link-free canvas appears as `{}`.
- **Settled canvas edge semantics (tickets `nid_s676x55uojmtcwh9t4l9mc6zl_e`, `nid_ygo7h95ssgmunaqsprc1zlmfh_e`), binding on BOTH paths:** a canvas links whatever its FILE nodes reference AND whatever the links inside its TEXT nodes reference — a text node is markdown, so that means wikilinks (`[[note]]`, `![[note]]`) AND markdown-style inline links (`[a](note.md)`, `![alt](pic.png)`) alike. Every text-node link resolves exactly like a markdown body link (`getFirstLinkpathDest`, relative to the canvas), so aliases and `#subpaths` resolve to the document and dangling links produce no edge; a markdown-style destination reaches that same resolver normalised to link text (title dropped, `#`/`?` stripped, then percent-decoded — in that order, so an encoded `:` cannot masquerade as a URI scheme). Destinations carrying a URI scheme or protocol-relative `//host/…`, external `link` nodes and `group` nodes reference no document. A destination with an UNENCODED space is not a link at all (CommonMark forbids one in a bare destination), so it yields no edge — truncating it at the space would name a different, possibly existing document, and a WRONG edge is worse than a missing one.
- **The `core-indexed` side of those semantics is MEASURED, not assumed** — `e2e/canvasMarkdownLinkIndexing.e2e.ts` reads `resolvedLinks` out of a real Obsidian (1.12.7) for a canvas text node carrying every destination shape. Observed: markdown-style links ARE indexed, keyed by resolved path (`{"md-links/target.md": 4, "md-links/spaced target.md": 1}`); `%20` resolves to the spaced file; an unencoded space and an external URL produce nothing; and `getFirstLinkpathDest` — the seam the fallback resolves through — accepts `target.md`, `./target.md` and `../md-links/target.md` alike, so relative destinations do not diverge between the regimes. Every unit-level parity test hand-seeds `resolvedLinks`, so that spec is the only thing that can falsify the premise the fallback is built on.
- **Why both paths must agree, not merely both exist:** `resolvedLinks` fills asynchronously at vault boot, so which regime a rebuild lands in is a race we do not control. That race is only harmless while the two regimes report the same edge set — a divergence turns into "the graph depends on how fast you opened it". Known residual divergence: links inside code spans/fences within text nodes (core skips them, the fallback's honest-but-small matchers harvest them — ticket `nid_869bt9d9rlrbr8of1403dnmf3_e`). Edge ORDER is not contractual on either path — the fallback scans a text node once per syntax, so it reports wikilinks before markdown-style links rather than in written order.
- The fallback's text-node scan rides the existing mtime-keyed `CanvasParseCache`, so it costs nothing per rebuild; only link RESOLUTION re-runs, because a rename changes a target without touching the canvas's mtime.
- Stock Obsidian 1.12.7 does index canvases, including their text-node links — measured, see the bullet above. Whether an OLDER install does is unknown, and the adaptive design is correct on every install either way.
- The fallback path is a known stale-data risk and gets dedicated test coverage, including fixtures with canvas entries deliberately absent to exercise detection.

### Rendering and interaction

- Custom node component: title, **first image as thumbnail** (lazy-loaded, fixed height, "+N" badge for more), **icon strip per attachment extension with counts**, click on an icon opens a dropdown listing those files. Everything past the first image loads lazily; rely on React Flow viewport culling.
- **In-node markdown outline** shares the thumbnail's preview slot: a node above the 104px container-query threshold shows EITHER its heading outline OR its first image, decided by the global three-way **Preview** setting (`auto` | `outline` | `image`, default `auto`, exposed as a pill on the settings tab AND in the graph controls panel). Under `auto` — the shipped default — **document position still decides**, exactly as it always has: an image before the first heading wins, the documented "show the picture" escape hatch. `outline` / `image` are opt-in overrides of that position rule, and neither can empty a node (a preference with nothing to show falls back to the other kind). Rendered as a real nested list, capped by the global **Outline depth** setting (1–6, default 2) plus a render budget, scrollable with a hover-only scrollbar and per-entry ellipsis. Owned by a dedicated `NodeOutline` component so the UI can be iterated independently of node rendering.
- **Where that decision lives:** the adapter (`ObsidianLinkProvider`) only reports the FACT (`FileMetadata.imagePrecedesOutline`) and always extracts the outline; the precedence rule is one pure function, `view/nodePreviewChoice.ts`, applied over the depth-filtered outline. The chosen kind travels as `FlowNodeData.preview`, so `NoteNode` renders and decides nothing. `sizePx` deliberately does NOT depend on the preference — a flip stays a data-only refresh instead of crossing `SIZE_RELAYOUT_THRESHOLD`. This is also why the image height floor (see Sizing) keys off "the note has an image", not off the chosen preview kind: a note with an image reserves the space even while the outline currently occupies the slot. The 104px threshold is knowledge held in both the stylesheet (as a content-box height) and `THUMBNAIL_VISIBLE_MIN_NODE_PX` (as that plus the node's 18px chrome — see Sizing); `src/view/thumbnailDensityThreshold.test.ts` parses the CSS and fails on drift.
- Folder groups render **only at 2+ members**; singletons get a folder-colored accent instead. Group colors: deterministic hash of folder path into a palette (user-assignable later).
- **Edges show direction** (arrowheads). A→B and B→A render as **two arrows**, offset with opposite curvature. Multiple links between the same ordered pair collapse into one edge with a count badge.
- Styling pulls from **Obsidian theme CSS variables**, so light/dark themes just work.
- Interactions: click opens the note, **clicking an outline entry opens it at that heading** (same ctrl/cmd new-tab gesture), ctrl/cmd-click for the alternate target, hover fires Obsidian's `hover-link` for native page previews — scoped to the note's content zone (title + thumbnail), so the interactive tiles below (attachment chips, pin button) stay a hover dead zone and the popover never covers the affordance being clicked.
- View placement: **right sidebar by default** (matches native local graph muscle memory), registered as a normal view type so it can be dragged into the main area. Follows the active file; per-leaf `getState`/`setState` so workspace restore works with multiple views open.

### Layout stability

- After each rebuild, **diff the node/edge structure**. Unchanged structure skips layout entirely and only refreshes node data.
- Exception: if any surviving node's computed size grew beyond **`SIZE_RELAYOUT_THRESHOLD`** (a named constant, initially 1.0, meaning +100%, e.g. a large paste), trigger a full relayout so the graph does not turn ugly.
- Structural changes accept layout jumps in V1. Position-seeding elk for incremental stability is a V2 refinement.

### Testing

- **The engine is pure**: traversal, sizing, truncation, and settings resolution are functions with no Obsidian imports, tested against a fixture-driven **FakeLinkProvider**. The `LinkProvider` interface is the only boundary to Obsidian and the seam where canvas detection lives.
- Fixture suite includes canvas JSON files for the fallback parser and provider variants without canvas entries. Because the regime is chosen by a boot race, canvas coverage is written as PARITY tests: the same canvas is asserted through both paths, which must AGREE on the edge set (see the settled semantics under **Canvas support**). Those tests hand-seed the `core-indexed` side, so what core ACTUALLY indexes is pinned separately by `e2e/canvasMarkdownLinkIndexing.e2e.ts` against a real Obsidian.
- Obsidian adapter code stays thin; correctness lives in the tested core.

## Phased Plan

**Phase 0, scaffold.** Plugin template (TS, esbuild), React 18 in an ItemView, vitest, submodule wired, manifest with minAppVersion. Deliverable: empty plugin loads in a dev vault, tests run.

**Phase 1, core engine.** Pure and fully tested: types, LinkProvider interface + fake, multi-root directional BFS with attachment collection and min-depth tagging, truncation with the priority chain, sizing engine, settings resolver (per-root depth + view cascade).

**Phase 2, Obsidian adapters.** ObsidianLinkProvider over resolvedLinks/getBacklinksForFile, canvas capability detection, fallback canvas parser against fixtures. Includes the devtools verification of what the install actually indexes.

**Phase 3, persistence.** data.json globals and pins; doc-data per-doc files with pin-on-toggle and centralDepths; id resolution via the submodule; delete handling; delayed chunked orphan sweep.

**Phase 4, view shell.** ItemView + React, MAIN tracking and follow-active-file, per-leaf state, rebuild pipeline: events → engine → structural diff → elkjs → React Flow. Deliverable: first visible graph with plain nodes. The milestone where it feels real.

**Phase 5, rendering.** Rich nodes (thumbnails, icon strips, dropdowns), MAIN/pinned/regular styling, folder groups, directed edges, truncation badges, theme integration.

**Phase 6, controls.** In-view toolbar: central selector with per-central depth steppers, expandable sizing controls, cap setting, pin/unpin on nodes, reset-to-global affordances. Global settings tab for defaults.

**Phase 7, hardening.** Dense-vault fixtures, cap edge cases, image-loading and rebuild-frequency performance pass, README.

Rationale for the order: Phases 1 through 3 contain every design decision in this document and run entirely without Obsidian, so rework risk concentrates where iteration is cheapest. The UI consumes a stable, tested engine.

## Deferred to V2+

- Per-view sizing overrides (data format is already shaped for it).
- Position-seeded incremental layout.
- Unresolved link ghost nodes (toggle, off by default).
- User-assignable folder colors.
- Manual node position persistence, if ever.