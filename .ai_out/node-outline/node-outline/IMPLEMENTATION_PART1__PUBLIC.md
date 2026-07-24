# IMPLEMENTATION_PART1__PUBLIC — node-outline steps 1–5

Role: `IMPLEMENTATION_PART1`. Scope: **steps 1–5 only** of
`DETAILED_PLANNING__PUBLIC.md`. Steps 6–10 are untouched — no half-built
step-6+ artifacts exist.

## Status

| | |
|---|---|
| `npm run check` | **PASS** (clean) |
| `npm test` | **787 passed, 3 failed** — all 3 failures are **PRE-EXISTING on `main`**, unrelated to this work (see below). Baseline before my first commit: 737 passed / **the same 3** failed. |
| Commits | 5, one per step, tree clean |

### The 3 pre-existing failures (NOT mine, NOT fixed — ticket filed)

`22bd5cb` ("Adjust node spacing defaults and increase one of the max in
settings") changed `SETTINGS_SPEC` values without re-pinning the three baseline
tests that exist to catch exactly that drift:

- `src/engine/SettingsSpec.test.ts` › "default values equal the exact shipped baseline" (`collidePaddingPx` 20 vs 50)
- `src/engine/SettingsSpec.test.ts` › "limits equal the exact shipped baseline" (`linkGapPx.max` 150 vs 250, `collidePaddingPx.max` 80 vs 100)
- `src/engine/forceLayoutSettings.test.ts` › "defaults equal the ticket-03 shipped layout constants"

I did **not** re-pin them: deciding the new numbers are the intended shipped
defaults is the author's call, and silently updating an assertion to match an
unverified change is the exact anti-pattern these tests guard. Filed as
`docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md`.

---

## What was built, per step

### Step 1 — outline eligibility predicate (`6e6e628`)

- `src/shared/FileKinds.ts`: `isMarkdownPath`, `isOutlineBearingPath`
  (markdown minus `*.excalidraw.md`, case-insensitive suffix), plus the two
  private constants.
- `src/adapters/ObsidianLinkProvider.ts`: deleted local `MARKDOWN_EXTENSION`,
  now uses `FileKinds.isMarkdownPath(file.path)` at both existing sites.
  `CANVAS_EXTENSION` stays local (adapter-specific).
- Tests (`src/shared/FileKinds.test.ts`, +5): markdown → true; excalidraw →
  false; `X.Excalidraw.MD` → false (case); `.canvas` → false; excalidraw is
  **still node-bearing** (pins CLARIFICATION Q4).

### Step 2 — `HeadingPort` + reference offsets (`adf4fb8`)

- `src/adapters/ReferenceOrder.ts`: `OrderedReference {link, offset}`,
  `FRONTMATTER_REFERENCE_OFFSET = -1`, `orderedReferences()`.
  `orderedLinkTexts()` is now a one-line projection of it (single ordering truth).
- `src/adapters/obsidianPorts.ts`: `HeadingPort {heading, level, position.start.offset}`
  and `CachedMetadataPort.headings?: readonly HeadingPort[]`.
- Tests (`ReferenceOrder.test.ts`, +2): frontmatter first at the sentinel offset;
  body links + embeds ascending by offset. No behaviour change.

### Step 3 — outline through the engine seam + image-vs-outline (`750de65`)

- `src/engine/types.ts`: `OutlineEntry {rawText, level}`; `GraphNode.outline`
  (**required**, `readonly OutlineEntry[]`).
- `src/engine/LinkProvider.ts`: `FileMetadata.outline` (required) with the
  three-cases-collapse-to-empty rationale on the field.
- `src/engine/index.ts`: exports `OutlineEntry`.
- `src/engine/VicinityTraversal.ts`: `TraversedNode.outline`, echoed in `assemble()`.
- `src/engine/FakeLinkProvider.ts`: `FakeFileSpec.outline?` (default `[]`).
- `src/adapters/ObsidianLinkProvider.ts`: `outlineOf`, `firstImageOffsetOf`,
  `orderedMarkdownReferences`; `getFileMetadata` reads `getFileCache` **once**
  and passes it to both consumers; `frontmatterTitleOf` became a module-level
  function taking `(file, cache)` (it no longer needs `this` — see deviations).
- `src/view/testFixtures/graphFixtures.ts`: `makeNode` defaults `outline: []`.
- Tests: `ObsidianLinkProvider.test.ts` +15 (`describe("ObsidianLinkProvider note
  outline")`) covering doc order, levels, verbatim inline markdown, canvas,
  excalidraw (+ still node-bearing), no-headings-key, no-cache-entry,
  headings-without-image, image-before-heading, image-after-heading,
  frontmatter image, image-without-headings, non-image attachment before the
  first image, and attachments' exact reference order (the refactor's real
  hazard). `FakeLinkProvider.test.ts` +2, `VicinityTraversal.test.ts` +2,
  `VicinityEngine.test.ts` +1 (spread-through guard).

### Step 4 — `outlineMaxDepth` setting, end to end (`bf17505`)

- `SettingsSpec.ts`: `globalView.outlineMaxDepth: {default: 2, min: 1, max: 6, step: 1}`
  (`BoundedNumberSpec`), WHY on the leaf.
- `types.ts`: `ViewSettings.outlineMaxDepth: number`.
- `constants.ts`: `DEFAULT_OUTLINE_MAX_DEPTH`, `MIN_OUTLINE_DEPTH`,
  `MAX_OUTLINE_DEPTH`, `clampOutlineMaxDepth(value)` (rounds + clamps);
  `EngineDefaults.viewSettings()` projects the default. All re-exported from
  `src/engine/index.ts`.
- `ViewSettingsResolver.resolve()`: `outlineMaxDepth: field("outlineMaxDepth")`.
- `persistedShapes.ts`: `parseViewOverride` clamps with the SAME
  `clampOutlineMaxDepth`.
- `settingsWritePlan.ts`: interaction `{kind: "global-outline-depth", value}` →
  existing `global-view` command.
- `VicinityGraphSettingTab.ts`: new `renderNodeContents()` card ("Node contents"
  heading, one "Outline depth" slider) rendered **after** `renderSizing()`.
  Loaded the `obsidian-settings` skill first: uniform card sections (one
  grouping mechanism tab-wide), sentence case, no "settings" in the heading, no
  lone disclosure, bounds + step projected from the spec, save-on-change, no
  second reset scope introduced.
- Tests: `SettingsSpec.test.ts` +6, `settingsResolvers.test.ts` +2,
  `persistedShapes.test.ts` +5, `settingsWritePlan.test.ts` +2.

### Step 5 — view mapping: depth filter + render budget (`9bb109d`)

- `src/view/constants.ts`: `OUTLINE_RENDER_LIMIT = 40` with the WHY.
- `src/view/flowMapping.ts`: `FlowNodeData.outline: readonly OutlineEntry[]`
  (required); `toFlowNodeData(node, mainPinned, outlineMaxDepth)` does
  `filter(level <= maxDepth).slice(0, OUTLINE_RENDER_LIMIT)`; `maxDepth` comes
  from `graph.viewSettings.outlineMaxDepth` at the `vicinityGraphToFlow` call site.
- Tests: `flowMapping.test.ts` +7 (depth drop, order preserved, depth 6 keeps
  all, budget cap, filter-before-slice, empty → `[]`, `firstImagePath` still
  mapped) and `GraphStructureDiff.test.ts` +1 (outline change → `reuse-layout`).

---

## What the next agent (steps 6–10) consumes — exact names

```ts
// src/engine/index.ts
export type { OutlineEntry };              // { readonly rawText: string; readonly level: number }
export { DEFAULT_OUTLINE_MAX_DEPTH, MIN_OUTLINE_DEPTH, MAX_OUTLINE_DEPTH, clampOutlineMaxDepth };

// src/view/flowMapping.ts — FlowNodeData
readonly outline: readonly OutlineEntry[];  // FLAT, RAW text, doc order, depth-filtered, ≤ OUTLINE_RENDER_LIMIT
readonly firstImagePath?: string;           // still mapped, unchanged
readonly path: string;                      // NodeOutline's `notePath`

// src/view/constants.ts
export const OUTLINE_RENDER_LIMIT = 40;
```

State of the step-5 boundary:

- `NoteNode.tsx` is **untouched** — it does not yet read `data.outline`, emits no
  `data-preview="outline"`, and no `NodeOutline`/`node-outline.css` exists.
- `viewPorts.ts`, `ObsidianNoteNavigator.ts`, `VicinityGraphFlow.tsx`,
  `nodeOpenIntent.ts`, `graph-view.css`, `esbuild.config.mjs` are **untouched**.
- `OpenNoteOptions` still has no `heading` field; there is no `NoteOpenContext`.
- `data.outline` is always present (never `undefined`) — no defensive branch needed.
- `entries` is a **fresh array on every rebuild** (`.filter().slice()`), so a
  `useMemo` keyed on it can never hit — plan D7 already says not to add one.

---

## Deviations from the plan (2, both minor, both recorded here)

1. **`frontmatterTitleOf` moved from a private method to a module-level
   function** in `ObsidianLinkProvider.ts`. The plan only said "`getFileMetadata`
   reads the cache once and passes it down". Once the cache is a parameter the
   method no longer touches `this`, and the file already has module-level
   helpers (`engineFolderOf`, `dedupe`, `appendToMultimap`) as the local idiom.
   Behaviour identical; its 9 existing tests pass unchanged.
2. **The outline-depth slider step is read from the spec**
   (`SETTINGS_SPEC.globalView.outlineMaxDepth.step`, via a named module constant
   `OUTLINE_DEPTH_SLIDER_STEP`) rather than typed as a literal `1` the way the
   existing depth slider does. The spec leaf declares a `step`; typing `1` a
   second time would be exactly the drift the spec exists to prevent.

Additionally, `src/engine/SettingsSpec.test.ts`'s "EngineDefaults.viewSettings
projects the spec defaults" assertion gained one line (`outlineMaxDepth`) — it
enumerates the projection field by field, so a new field must be listed. Not a
weakening: the assertion still pins every field to its spec default.

## Notes for review

- `GraphStructureDiff.test.ts`'s new test cannot fail **today** (`decideLayout`
  never reads node data). It is kept deliberately per plan §5 T30 as the guard on
  D1's claim that "an outline array cannot flip a layout decision" — it fails the
  moment someone makes the diff data-sensitive. Flagging it since the plan review
  cut other unfailable tests.
- No persisted-shape version bump (outline is recomputed per rebuild); only the
  new setting needed parse wiring, which is additive and defaults cleanly.
- Engine purity held: nothing new imports `obsidian`/`react` under
  `src/engine/` or `src/shared/` (`importGuard.test.ts` green).
