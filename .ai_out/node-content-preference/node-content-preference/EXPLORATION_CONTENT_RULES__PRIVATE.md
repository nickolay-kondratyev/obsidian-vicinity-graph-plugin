# Private working notes — node content-preference exploration

Purpose: enough breadcrumbs for a clone of me to rehydrate without re-reading
everything. This is the "how I found it" trail plus loose ends I did NOT
fully chase (out of scope per the task: no implementation).

## Session trail (what I ran, in order)

1. `cat CLAUDE.md`, `cat docs-internal/architecture-map.md` — got layering
   rules (`view → adapters → engine (pure)`) and the pointer that
   `NodeOutline.tsx` "owns in-node outline rendering" and `view/viewPorts.ts`
   has `NoteOpenPort`.
2. `grep -rl -i "outline|excerpt|image" src/**/*.{ts,tsx}` — found the full
   candidate file set. No "excerpt" hits anywhere → confirmed there is no
   excerpt/body-text preview mode at all, only outline/image/none.
3. Read `src/view/nodePreviewChoice.ts` + its test FIRST — this is the
   smallest, most legible seam and its doc-comment directly says "the
   ADAPTER already applied the image-vs-outline rule" — that's the thread
   that led straight to `ObsidianLinkProvider.ts`.
4. `grep -rn "before the first heading|image-vs-outline"` across `src/` —
   this one grep surfaced EVERY file that talks about the rule:
   `ObsidianLinkProvider.ts` (impl + doc), `ObsidianLinkProvider.test.ts`
   (tests), `ReferenceOrder.ts` (offset plumbing), `FakeLinkProvider.ts`
   (fixture doc disclaiming re-derivation), `SettingsSpec.ts` (outlineMaxDepth
   comment mentioning the escape hatch), `VicinityGraphSettingTab.ts` (UI
   copy + "no toggle by design" comment), `nodePreviewChoice.ts`/`.test.ts`.
   This one grep essentially IS the map of "where does this rule live."
5. Read `ObsidianLinkProvider.ts` in full (258 lines) — `outlineOf` (~145-166)
   and `referencesImageAbove` (~179-190) are the core. Confirmed: adapter-only,
   returns `[]` (empty array) when image wins — headings are NEVER mapped to
   `OutlineEntry[]` in that branch, i.e. genuinely discarded, not just flagged.
6. Read `ReferenceOrder.ts` in full (48 lines) — trivial, just establishes
   the shared ascending-offset ordering + frontmatter sentinel.
7. Read `engine/types.ts` (GraphNode/OutlineEntry/AttachmentRef/ViewSettings
   region, lines ~1-280) — got the branded types and confirmed
   `firstImagePath` and `outline` are SEPARATE fields on `GraphNode`, both
   independently populated.
8. Read `VicinityTraversal.ts` (imports through `assemble()`, ~1-220) —
   confirmed `firstImagePath` comes from `metadata.attachments.find(isImage)`
   — completely independent of whatever the adapter did to `outline`. This
   is THE key structural fact: image data survives even when outline data
   doesn't.
9. `grep` for `outlineMaxDepth|outlineEntryCount|fits|truncat"` across view+engine
   — found `flowMapping.ts` (depth filter + OUTLINE_RENDER_LIMIT slice),
   `graphIdentity.ts` (nodeDimensionsPx: height = sizePx verbatim),
   `NoteNode.tsx` (comment: "CSS container queries — no JS measuring"),
   `VicinityGraphSettingTab.ts:84` ("Node CONTENTS follow node SIZE").
10. Read `flowMapping.ts` in full (~340 lines) — `toFlowNodeData` at the
    bottom is the exact filter/slice logic (search "Filter THEN slice").
11. Read `NoteNode.tsx` in full — `nodePreviewKind` call site, `data-preview`
    attribute, the mutually-exclusive render branches for
    thumbnail/outline, the preview-zone hover-dead-zone comment block.
12. Read `NodeOutline.tsx` in full — confirmed it does NO precedence/fit
    logic; pure rendering of an already-decided `entries` array.
13. `find src/view -name "*.css"` then read `graph-view.css` (grep first for
    container/104px/preview-zone, then read lines 60-270 in full) — this is
    where the "fits" logic ACTUALLY lives: `@container (min-height: 104px)`.
    Also read `node-outline.css` in full (80 lines) — scrolling/ellipsis
    mechanics, confirms overflow is handled by scroll, not truncation.
14. `grep` SettingsSpec.ts + VicinityGraphSettingTab.ts around outlineMaxDepth
    — got the "≤160px node" sizing comment and the settings-tab copy/doc
    that explicitly says "No enable/disable toggle by design (CLARIFICATION
    Q2)".
15. `grep -n outline|firstImagePath` across test files
    (`ObsidianLinkProvider.test.ts`, `flowMapping.test.ts`,
    `VicinityTraversal.test.ts`, `VicinityEngine.test.ts`,
    `nodePreviewChoice.test.ts`) — enumerated every existing behavior-locking
    test. No `NoteNode.test.tsx` or `NodeOutline.test.tsx` exists — checked
    via `find src -iname "*NoteNode*" -o -iname "*NodeOutline*"` (only .tsx
    files, no .test siblings).
16. `grep -i "outline|image|thumbnail|precedence|preview"
    docs-internal/plan/high-level-plan.md` — found lines 7, 92, 93, 97, 124,
    128. Line 93 is THE paragraph (quoted in full in the public doc).
17. `grep -i` same terms in `README.md` — found the "### Node contents"
    section (lines ~137-146) which is basically a plain-English restatement
    of `outlineOf`'s logic, plus the outline-depth bullet (~64-65).
18. Skimmed `SettingsSpec.ts` top (BoundedNumberSpec etc.), `ViewSettingsResolver.ts`
    in full (61 lines) — confirmed the per-field cascade mechanism
    (`MAIN override → pinned override (ranked) → global`), useful context
    for "where would a new setting plug in" even though I didn't chase it
    further since implementation is out of scope.
19. Checked `FileKinds.ts` grep for `isOutlineBearingPath`/`isImagePath` line
    numbers only (didn't read full file — not load-bearing for this task,
    just wanted to confirm they exist and roughly what they gate: markdown
    minus excalidraw for outline-bearing; extension allowlist for image).

## Things I noticed but did NOT fully verify (leads for follow-up, not facts)

- I did not open `NodeSizer.ts` in full — only confirmed via grep that it's
  where `sizePx`/sizing metrics live and that it's unrelated to outline/image
  choice (no hits for outline/image terms in it). If a future "fits" check
  needs actual sizing internals (min/max px bounds, `SIZE_RELAYOUT_THRESHOLD`),
  that file is the place, plus `src/engine/constants.ts`.
- I did not open `outlineTree.ts` / `outlineEntryLabel.ts` in full — only
  confirmed via `NodeOutline.tsx` imports that they build the nested tree and
  strip inline markdown from `rawText` for display. Not load-bearing to the
  precedence question but relevant if the eventual UI needs to preview/count
  "how much outline would render" before deciding it "fits."
- Did not check `persistence/persistedShapes.ts` in detail for how
  `ViewSettings` (and thus where a new field would be persisted/versioned)
  round-trips — flagged only that "every persisted shape carries a `version`
  field" per CLAUDE.md and that `outlineMaxDepth` is the nearest analogue.
- Did not check `docs-internal/tickets/` for any existing ticket already
  tracking this exact feature request — worth a quick grep
  (`grep -ril "image.*outline\|outline.*image\|content preference" docs-internal/tickets`)
  before starting implementation, in case there's prior design discussion.
- Did not check e2e tests (`e2e/`) for anything touching node preview
  rendering — `npm run test:e2e` is a real-Obsidian Playwright suite; if it
  has visual/DOM assertions on `data-preview` or `.vicinity-graph-outline`
  visibility, those would also be "must not break" surfaces. Worth a
  `grep -rn "data-preview\|vicinity-graph-outline\|vicinity-graph-node__thumbnail" e2e/`
  pass before implementing.
- `.ai_out/node-content-preference/node-content-preference/` already existed
  before this task (with a lone `TOP_LEVEL_AGENT.md`, contents unread — I
  didn't open it since the task only asked me to WRITE the two named files
  there, not audit prior agent state). Might be worth reading if continuing
  this feature across sessions.

## Key facts to remember (condensed, for fast rehydration)

- Precedence rule lives in `ObsidianLinkProvider.outlineOf` /
  `.referencesImageAbove` (`src/adapters/ObsidianLinkProvider.ts:145-190`).
  It is the ONLY place with the rule. It DESTROYS heading data on the
  image-wins path (returns `[]` before mapping headings).
- `firstImagePath` (engine) / `data.firstImagePath` (view) is ALWAYS
  populated when an image attachment exists, regardless of the outline rule
  — derived independently in `VicinityTraversal.assemble`
  (`src/engine/VicinityTraversal.ts:~157,168`).
- View-layer slot arbitration: `nodePreviewKind` in
  `src/view/nodePreviewChoice.ts:20-25` — trivial, and by its own doc-comment
  never actually has to arbitrate a real conflict today (outline entries only
  exist when the adapter already let them win).
- "Fits" = a static CSS container-query breakpoint at 104px node height
  (`src/view/graph-view.css:237-256`), nothing computed in JS. Below 104px,
  NEITHER outline nor thumbnail render (only title, and attachment chips
  above 72px). Overflow within the slot scrolls (`node-outline.css`), it's
  never truncated by measurement.
- Rendering: `NoteNode.tsx` picks the slot + stamps `data-preview`;
  `NodeOutline.tsx` renders outline internals only, no decision logic.
- `docs-internal/plan/high-level-plan.md:93` is the one paragraph defining
  this whole feature at the design level. `README.md:137-146` and
  `VicinityGraphSettingTab.ts:313-319` restate/reinforce it as a closed
  design decision ("no toggle by design").
- Tests that WILL need to keep passing (or be deliberately/consciously
  updated with equivalent new coverage) are enumerated in §5 of the public
  doc: `ObsidianLinkProvider.test.ts` (image-wins/loses cases),
  `nodePreviewChoice.test.ts` (all 3), `flowMapping.test.ts` (outline mapping
  block + firstImagePath-independent-of-outline case at line ~509-520),
  `VicinityTraversal.test.ts` ("outline echo" describe block),
  `VicinityEngine.test.ts` ("outline pass-through" describe block).
