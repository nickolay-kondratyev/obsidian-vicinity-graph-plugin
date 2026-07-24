# IMPLEMENTATION_PART2__PUBLIC — node-outline steps 6–10

Role: `IMPLEMENTATION_PART2`. Scope: **steps 6–10 only** of
`DETAILED_PLANNING__PUBLIC.md`. Steps 1–5 (part 1) were not reworked.

## Status

| | |
|---|---|
| `npm run check` | **PASS** (clean) |
| `npm test` | **815 passed / 3 failed** — the same 3 **PRE-EXISTING** failures from `22bd5cb` (`SettingsSpec.test.ts` ×2, `forceLayoutSettings.test.ts` ×1, `collidePaddingPx` 20 vs 50). Not touched, not re-pinned. Baseline before my first commit was 790/3. |
| `npm run test:e2e` | **RUN, against real Obsidian 1.12.7** (the harness auto-downloads it). All **8 new outline cases PASS**. Suite total: 33 passed / 2 failed — both failures **reproduced on `main` (22bd5cb)** in a clean worktree and already ticketed. |
| Commits | 5, one per step, tree clean |

### The 2 remaining e2e failures (verified pre-existing, already ticketed)

Nobody had run the e2e gate on this branch before me, so I ran it and triaged
every failure rather than assuming.

| Failing test | Verified on `main`? | Ticket |
|---|---|---|
| `edgeRoutingEval.e2e.ts` › radial layout SKIPS routing (gated) | YES — fails identically at `22bd5cb` | referenced from the gamma ticket (`e2e-remove-layeredradial-layout-mode-references…`) |
| `vicinityGraph.e2e.ts` › singleton-folder note shows a folder breadcrumb | YES — fails identically at `22bd5cb`; `.vicinity-graph-node__breadcrumb` exists nowhere in `src/` | `ticket-e2e-gamma-breadcrumb-fails-headless.md` |

Method: `git worktree add .worktree/baseline 22bd5cb`, symlinked `node_modules`,
ran the two specs there, then removed the worktree. Log: `.tmp/e2e-baseline.txt`.

### One e2e failure THIS branch caused — fixed

`settingsUxVisual.e2e.ts` asserted **5** settings section cards. Part 1's step 4
added the "Node contents" card, making it **6**; part 1 never ran the e2e gate so
it went unnoticed. Updated the count **and** the test name, with a comment
enumerating the six sections. Not a weakening — the branch legitimately adds one.

---

## What was built, per step

### Step 6 — navigation seam, heading-targeted open (`96d4093`)

- **Add** `src/view/nodeOpenIntent.ts` — `ClickModifiers`, `opensInNewTab`,
  `outlineEntryOpenOptions`. No `headingLinktext` (review M1).
- **Modify** `src/view/viewPorts.ts` — `OpenNoteOptions.heading?` (RAW text,
  documented as adapter-sanitised) and `NoteOpenPort` (one method).
- **Add** `src/view/NoteOpenContext.ts` — mirrors `ControlsActionsContext.ts`.
- **Modify** `src/view/ObsidianNoteNavigator.ts` — value import of
  `stripHeadingForLink`; `openLinkText(\`${path}#${…}\`, path, newTab)` branch.
  The `getFileByPath` null guard stays **ahead of both branches** (D6: a stale
  node must never make `openLinkText` create a note).
- **Modify** `src/view/VicinityGraphFlow.tsx` — provides `NoteOpenContext`;
  `onNodeClick` now uses `opensInNewTab(event)`, so the ctrl/cmd rule exists once.

Tests (6, all verified failable by mutation):
- `nodeOpenIntent.test.ts` — ctrl → new tab; meta → new tab; no modifier →
  current tab; plain outline click carries the RAW heading + `newTab: false`;
  ctrl outline click carries the RAW heading + `newTab: true`.
- `GraphViewController.test.ts` — `openNode` passes the heading through
  **verbatim** (pins that sanitising is the adapter's job).

Mutations used: `ctrlKey || metaKey` → `ctrlKey`; drop `heading` from the
options; controller strips `heading` before forwarding → 4 tests went red.

### Step 7 — pure outline presentation logic (`d38c543`)

- **Add** `src/view/outlineEntryLabel.ts` — D9's ordered pipeline (leading `#`
  marker requiring whitespace, wikilinks/embeds with alias handling, md
  links/images, code, strong, emphasis, highlight, strike, whitespace collapse,
  empty → raw fallback). The "deliberately NOT handled" set is on the module.
- **Add** `src/view/outlineTree.ts` — `OutlineTreeNode`, `buildOutlineTree`;
  single-pass stack, nearest shallower ancestor, no filler nodes, no orphans.
- **Add** `src/view/nodePreviewChoice.ts` — `NodePreviewKind`, `nodePreviewKind`.

Tests (19): 10 label cases, 6 tree cases, 3 preview-choice cases. Mutations used
(dropped bold strip / dropped wikilink alias / dropped empty fallback / `>=` →
`>` in the tree stack) turned 5 of them red.

### Step 8 — `NodeOutline` component + CSS (`f5bc9a0`)

- **Add** `src/view/NodeOutline.tsx` — `NodeOutline` (scroll container,
  `nowheel nodrag nopan`), `OutlineBranch` (one `<ul>`, root-only `aria-label`),
  `OutlineEntryButton` (stripped label, `title`, `stopPropagation` then
  `useNoteOpen().openNote`). Props are `notePath` + `entries` only.
- **Add** `src/view/node-outline.css` — hover-only `scrollbar-color`, `ul` reset,
  ONE nesting knob (`--size-4-2` on nested lists), per-entry ellipsis, focus ring.
  Obsidian variables only.
- **Modify** `esbuild.config.mjs` — one line in `AUTHORED_CSS_FILES`.
- **Modify** `src/view/graph-view.css` — outline joins the thumbnail at the
  existing 104px threshold; `[data-preview="outline"] .…__preview-zone
  { flex: 0 0 auto }`.
- **Modify** `src/view/NoteNode.tsx` — `data-preview={nodePreviewKind(...)}`,
  thumbnail guarded by `preview === "thumbnail"`, `<NodeOutline>` as a **sibling**
  of the preview zone.
- `npm run build` verified: `styles.css` carries the new rules.

No vitest (no RTL/jsdom) — covered by step 9.

### Step 9 — dev-vault fixtures + Playwright e2e (`512905a`)

- **Modify** `scripts/setup-dev-vault.sh` — `outline-note.md` (11 depth-2
  headings, one H1 with two H2 children, two H3s, one markdown-carrying heading,
  image AFTER the first heading) and `outline-cover.md` (image BEFORE the first
  heading), plus a manual-check block in the closing banner.
- **Add** `e2e/nodeOutline.e2e.ts` — 8 cases (E1 as 3 sibling tests):
  labels in document order · real list nesting · no level-3 at default depth ·
  the `path#heading` linktext handed to `openLinkText` · the note becomes active ·
  scrollbar-color changes on hover · scrolling works while hidden (with an
  explicit `scrollHeight > clientHeight` precondition) · the image escape hatch.
- **Modify** `src/view/graph-view.css` — see the real bug below.
- **Modify** `e2e/settingsUxVisual.e2e.ts` — 5 → 6 section cards.

**A real bug the e2e caught.** The 104px reveal
(`.vicinity-graph-outline { display: block }` in `graph-view.css`) and the base
`display: none` in `node-outline.css` had **equal specificity**, and `styles.css`
concatenates `node-outline.css` **after** `graph-view.css` — so `none` won and the
outline never rendered at any size. Fixed by giving the reveal an ancestor
selector (`.vicinity-graph-node .vicinity-graph-outline`) as a deliberate
tie-breaker, with the WHY in the comment. WHY-NOT reordering `AUTHORED_CSS_FILES`:
that makes correctness depend on an invisible list order.

### Step 10 — docs + follow-up ticket (`ca77f7f`)

- `README.md`: **Outline depth** under global defaults; new **Node contents**
  section (outline-vs-image, escape hatch, click-to-heading, scroll/ellipsis);
  three limits added to V1 scope (first-match heading jump, no excalidraw
  outline, bounded display stripper — the link never depends on it).
- `docs-internal/plan/high-level-plan.md`: outline-preview bullet + the
  click-at-heading interaction.
- `docs-internal/architecture-map.md`: `NoteNavigatorPort`'s optional heading,
  `NoteOpenPort`/`NoteOpenContext`, `NodeOutline.tsx` + `node-outline.css`.
- **Add** `docs-internal/tickets/ticket-node-outline-live-refresh.md` —
  verify-first, states that `metadataCache.on("resolved")` is already wired and
  debounced, and forbids adding `changed` before a real measurement.
- No `change_log` entry, no `docs-internal/CHANGELOG.md` edit (TOP_LEVEL_AGENT).

---

## Deviations from the plan (4, all deliberate, none hacks)

1. **Step 9 fixture does NOT link to `note1`.** The plan wanted the
   markdown-carrying heading to be `## Status of [[note1]] **today**` and both
   fixtures linked from an existing central. That would add an incoming neighbour
   to `note1`, silently changing `NOTE1_NODE_COUNT` and `ORPHAN_BREAKDOWN` in
   `vicinityGraph.e2e.ts`. The heading links to `[[outline-cover]]` instead and
   the pair is self-contained — the same convention the script's other fixture
   families already state ("never link note1/crowd").
2. **The e2e asserts on the MAIN node, not "a big node on the alpha graph."**
   Only centrals bypass sizing composition (`CENTRAL_SIZE_SCORE` → `maxPx`), so
   MAIN is the one node whose height above the 104px threshold is deterministic;
   a neighbour's size depends on the whole node set. E3 stays non-vacuous by
   first opening a **non-node-bearing** file (`pic.jpg`), which the controller
   ignores — the graph keeps showing outline-note's vicinity while the active
   file is something else, so "it became active" is a real observation.
3. **Plan §5 T63's example is wrong; the test uses a different input.** `****`
   does not strip to empty (the strong regex needs content between the markers),
   so that test could not exercise the empty-label fallback. It asserts on `[]()`,
   which genuinely strips to empty. Behaviour asserted is exactly the plan's.
4. **E2 clicks a plain-prose heading**, not the markdown-carrying one. The spy
   records the linktext *after* `stripHeadingForLink`, so asserting on a marked-up
   heading would pin Obsidian's sanitiser internals rather than our contract. A
   plain heading makes the expected value exactly `outline-note.md#Background`.

Also worth flagging: `outlineEntryLabel` uses
`link.slice(link.lastIndexOf("|") + 1)` rather than `split("|").at(-1)` — `.at()`
needs ES2022 and this repo targets ES2021, and the `?? fallback` an index access
would need under `noUncheckedIndexedAccess` would be unreachable code.

## Notes for review

- `ObsidianNoteNavigator.ts` is now unit-untestable by construction (value import
  of `obsidian`, no runtime alias in `vitest.config.ts`). This was planned (D6),
  is already true of every `Obsidian*` adapter here, and its heading branch is
  covered by e2e E2/E3.
- **Not done:** the plan's manual dev-vault check ("does Obsidian scroll to and
  flash the heading, in both editing and reading view"). That needs a human at a
  GUI Obsidian; the e2e covers our side of the contract only. It is called out in
  the step-9 commit message and in the dev-vault banner.
- `data-preview` now carries all three honest values (`outline` / `thumbnail` /
  `none`), so the old POLS lie is gone.
- No `ap_XXX_E` anchor touched, no behaviour-capturing test removed or weakened,
  no persisted-shape change, no engine-purity violation (`importGuard` green).

## Questions for the human

None.
