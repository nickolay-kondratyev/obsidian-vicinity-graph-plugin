# IMPLEMENTATION — `node-content-preference`, Phases 1 + 2

Scope of this run: **Phase 1 and Phase 2 only** (per the plan's §4). Phases 3, 4
and 5 are deliberately untouched — see "What remains" below.

Branch `node-content-preference`, 2 commits, working tree clean:

| Commit | Phase |
|---|---|
| `7b9995a` `refactor(node-preview): report the document-position fact, decide in the view` | Phase 1 |
| `f065510` `feat(node-preview): global Preview preference, end to end (no UI yet)` | Phase 2 |

## VERIFIED results (actually run, not assumed)

- `npm run check` (tsc strict): **clean, exit 0** — after Phase 1 and again after Phase 2.
- `npm test`: **1 failed | 892 passed (893)**, 1 failed file | 66 passed (67).
  The single failure is the known-RED, pre-existing
  `SettingsSpec.test.ts > … limits equal the exact shipped baseline`
  (`linkStrengthFactor.max` expected 2, spec says 4). Not touched, not caused
  here — the reviewer's baseline was 1 failed | 852 passed (853); we added 40
  passing tests and fixed none/broke none.
- `npm run build` (check + esbuild production bundle): **exit 0**.
- `npm run test:e2e`: NOT run (out of scope, release gate).

## Phase 1 — decision moved downstream, ZERO behavior change

The adapter no longer encodes "the image wins" by deleting the outline; it
reports the fact and the view decides.

| File | Change |
|---|---|
| `src/engine/LinkProvider.ts` | `FileMetadata.imagePrecedesOutline: boolean` (**required**). Rewrote the `outline` doc (it no longer claims the image case empties it) and documented the fact's `false` edges (no first heading / not outline-bearing / unresolvable reference). |
| `src/adapters/ObsidianLinkProvider.ts` | `outlineOf()` → `outlineFactsOf(file, cache, references): NoteOutlineFacts`; new adapter-local `interface NoteOutlineFacts { outline; imagePrecedesOutline }` + module const `NO_OUTLINE_FACTS`. `getFileMetadata` spreads it (field names match `FileMetadata` on purpose). `referencesImageAbove` untouched (only its doc sentence reworded). `// The image wins.` deleted. |
| `src/engine/FakeLinkProvider.ts` | `FakeFileSpec.imagePrecedesOutline?: boolean` (default `false`), set in `declareFile`; both fixture doc-comments now say the fixture supplies the FACT. |
| `src/engine/VicinityTraversal.ts` | `TraversedNode.imagePrecedesOutline: boolean` + echo in `assemble`. |
| `src/engine/types.ts` | `GraphNode.imagePrecedesOutline: boolean` (arrives free via `VicinityEngine.ts:83`'s `...node` — no engine edit needed). |
| `src/view/nodePreviewChoice.ts` | `NodePreviewInput` gains `imagePrecedesOutline`; doc rewritten (adapter no longer pre-decides). |
| `src/view/flowMapping.ts` | `toFlowNodeData(node, mainPinned, view: ViewSettings)` (was `outlineMaxDepth: number`); filtered outline computed FIRST; new `FlowNodeData.preview: NodePreviewKind`. |
| `src/view/NoteNode.tsx` | `nodePreviewKind` call + import deleted; renders `data.preview` at all three sites; class docblock says it decides nothing. |
| `src/view/testFixtures/graphFixtures.ts` | `makeNode` gains `imagePrecedesOutline: false`. |

Tests (Phase 1): 18 new/changed, all red before the implementation, green after.
- `nodePreviewChoice.test.ts` — 5 fact-based rows (§6.A auto rows).
- `ObsidianLinkProvider.test.ts` — the two "outline is empty (the image wins)"
  cases **inverted in place** (they now assert the outline SURVIVES, because the
  adapter genuinely no longer empties it), plus a new
  `describe("ObsidianLinkProvider imagePrecedesOutline")` with the 8 fact rows
  (§6.B 18–25). The "image wins" substance survives in
  `nodePreviewChoice`'s auto rows + `flowMapping`'s auto rows, as CLARIFICATION
  permits ("may be relocated … must survive in substance").
- `VicinityTraversal.test.ts` (§6.C 26–27), `VicinityEngine.test.ts` (§6.C 28).
- `flowMapping.test.ts` — new `describe("vicinityGraphToFlow preview decision")`
  (§6.D 29, 32, 33) + `preview: "none"` added to the two hand-built
  `FlowNodeData` literals (correct, anticipated failures).

## Phase 2 — the setting end to end, still ZERO behavior change

| File | Change |
|---|---|
| `src/engine/types.ts` | `NodePreviewPreference = "auto" \| "outline" \| "image"` (per-member doc), `NODE_PREVIEW_PREFERENCES` as `[...] as const satisfies readonly NodePreviewPreference[]` (the PLAN_REVIEW inline fix — the wide annotation would have made the assert vacuous), `_assertEveryNodePreviewPreferenceListed`, and `ViewSettings.nodePreviewPreference` directly after `outlineMaxDepth`. |
| `src/engine/index.ts` | exports `NodePreviewPreference` (type) and `NODE_PREVIEW_PREFERENCES` (value). |
| `src/engine/SettingsSpec.ts` | `ViewSpec.nodePreviewPreference: DefaultSpec<NodePreviewPreference>` + spec entry `{ default: "auto" }` with the WHY. |
| `src/engine/constants.ts` | `EngineDefaults.viewSettings()` projects the field. No unused `DEFAULT_*` alias added. |
| `src/engine/ViewSettingsResolver.ts` | `nodePreviewPreference: field("nodePreviewPreference")` in the explicit return list. |
| `src/persistence/persistedShapes.ts` | `parseViewOverride` validates via `NODE_PREVIEW_PREFERENCES.find(...)` (imported from `../engine`); `EDGE_VISIBILITY_MODES` untouched; `PERSISTED_SHAPE_VERSION` still **2**. |
| `src/view/settingsWritePlan.ts` | `SettingsInteraction` variant `{ kind: "global-node-preview"; value: NodePreviewPreference }` + its `planSettingsWrite` case → `{ kind: "global-view", view: { ...ctx.globalView, nodePreviewPreference: value } }`. **No executor change needed** (`ControlsActions`/`persist` already handle `global-view`). |
| `src/view/nodePreviewPreferenceMeta.ts` | **NEW** — `NodePreviewOptionMeta` + `NODE_PREVIEW_OPTION_META` (see deviation D1). |
| `src/view/settingsResetPlan.ts` | `node-contents` resets BOTH fields in ONE `global-view` command; its `description` reads the default's label from `NODE_PREVIEW_OPTION_META`. `SettingsResetScope`, `SECTION_RESET_SCOPES`, `ALL_SCOPE_DESCRIPTION` untouched ⇒ **section count stays 6**, reset-button name lists byte-identical. |
| `src/view/nodePreviewChoice.ts` | `NodePreviewInput.preference` + the exhaustive `switch` (no `default`, satisfies `noImplicitReturns`) below the two fallback guards. |
| `src/view/flowMapping.ts` | passes `preference: view.nodePreviewPreference` into `nodePreviewKind`. |
| `src/view/testFixtures/graphFixtures.ts` | `makeViewSettings` gains `nodePreviewPreference: "auto"`. |

Tests (Phase 2): 22 new/changed (13 red first, then green).
- `nodePreviewChoice.test.ts` — restructured into the full **3 × 5 truth table**
  (§6.A 1–15) across three describes, facts hoisted into named constants.
- `flowMapping.test.ts` — §6.D 30, 31, 34 (helper now takes `Partial<ViewSettings>`).
- `SettingsSpec.test.ts` — the field added to BOTH the defaults baseline literal
  (actual + expected `"auto"`) and the `EngineDefaults.viewSettings` projection.
- `persistedShapes.test.ts` — §6.F 38–41.
- `settingsResolvers.test.ts` — new `describe("ViewSettingsResolver node preview cascade")` (§6.G 42–43).
- `settingsWritePlan.test.ts` — §6.H 44.
- `settingsResetPlan.test.ts` — `TUNED_VIEW.nodePreviewPreference: "image"` (non-default, or 46/48 pass vacuously), the new §6.I 46, the §6.I 47 patch of "every other view field survives", and §6.I 48 under the `all` scope.
- `GraphStructureDiff.test.ts` — §6.J 49, the no-relayout tripwire.

## Deviations from the plan (all minor, none touching CLARIFICATION)

- **D1 — `nodePreviewPreferenceMeta.ts` created in Phase 2, not Phase 3.** Phase 2
  item 8 requires the reset description to read the label from the shared meta,
  but the plan created that module in Phase 3 item 1. Creating it in Phase 2 is
  the only way to satisfy item 8 without a re-typed `"Auto"`. Only the part with
  a Phase-2 consumer exists: `NodePreviewOptionMeta` + `NODE_PREVIEW_OPTION_META`.
  **`NODE_PREVIEW_ROW_LABEL` / `NODE_PREVIEW_ROW_DESCRIPTION` are intentionally
  NOT yet written** (no consumer until the tab row) — Phase 3 adds them to this
  existing file.
- **D2 — the `preference` wiring landed in Phase 2.** The plan's per-phase test
  lists never assigned §6.A rows 6–15 or §6.D 30/31/34 (and Phase 2's step list
  omits `nodePreviewChoice`/`flowMapping`), yet Phase 2 is titled "the setting,
  end to end". Without this the setting would be a no-op that Phase 3's UI
  toggles for nothing. §2.2's function body is implemented exactly as specified.
- **D3 — case 50 (the `imagePrecedesOutline ⇒ non-empty outline && first image`
  invariant) dropped**, taking the reviewer's explicit option ("split into
  50a/50b, **or drop 50 entirely** — cases 18 and 21 already pin the fact's
  inputs"). 50a would have duplicated case 16 verbatim, and `firstImagePath` is
  derived in the traversal, not on `FileMetadata`, so 50b would have restated the
  existing attachment-order test. The invariant is documented in
  `FileMetadata.imagePrecedesOutline` instead.
- **D4 — no standalone §6.E case 35** ("the shipped node-preview default is
  `auto`"): case 36's updated exact-baseline literal asserts precisely that
  (`nodePreviewPreference: "auto"` on both sides). A second identical assertion
  would be duplicate coverage.
- **D5 — `_assertEveryNodePreviewPreferenceListed` is exported from
  `engine/types.ts` but NOT re-exported through `engine/index.ts`** (the plan said
  "the const + assert"). It is a compile-time guard with no consumer; the const
  IS re-exported because persistence consumes it. Adding an unconsumed symbol to
  the engine's public API would contradict "no unused code" for zero benefit.
- Not a deviation, but worth stating: I did **not** run the dev-vault eyeball
  checks the plan lists under "Verification" (they need a running Obsidian); the
  automated equivalents are §6.D's auto rows + §6.J.

## Symbols the Phase 3/4 implementer will consume (exact, as implemented)

```ts
// src/engine/index.ts
export type { NodePreviewPreference };                 // "auto" | "outline" | "image"
export { NODE_PREVIEW_PREFERENCES };                   // readonly ["auto","outline","image"] — THE render order

// src/view/nodePreviewPreferenceMeta.ts
export interface NodePreviewOptionMeta { readonly label: string; readonly description: string }
export const NODE_PREVIEW_OPTION_META: Readonly<Record<NodePreviewPreference, NodePreviewOptionMeta>>;
// TODO Phase 3: add NODE_PREVIEW_ROW_LABEL = "Preview" and NODE_PREVIEW_ROW_DESCRIPTION here.

// src/view/settingsWritePlan.ts  (SettingsInteraction variant)
{ kind: "global-node-preview", value: NodePreviewPreference }
// → planSettingsWrite(...) returns { kind: "global-view", view: ViewSettings }

// src/engine/types.ts
ViewSettings.nodePreviewPreference: NodePreviewPreference   // read it for the controlled radio state
```

Read the current value from `this.store.globalView().nodePreviewPreference` (tab)
or `controls.globalView.nodePreviewPreference` (panel). Both surfaces write the
SAME global — no executor change is needed on either side.

## What remains (Phases 3–5, NOT started)

- **Phase 3** — settings-tab Preview row: `NODE_PREVIEW_ROW_LABEL` /
  `NODE_PREVIEW_ROW_DESCRIPTION` in the existing meta module, new
  `src/view/segmented-control.css` **+ its `AUTHORED_CSS_FILES` entry in
  `esbuild.config.mjs`** (risk §7.4 — no unit test can catch a missing entry),
  `renderNodeContents()` row above "Outline depth", `addNodePreviewSegmented`,
  and the superseded "No enable/disable toggle by design (CLARIFICATION Q2)"
  docblock at `VicinityGraphSettingTab.ts:312-320`. Radio `name` = a tab-local
  module constant.
- **Phase 4** — `src/view/NodeContentsSection.tsx` + `GraphToolbar.tsx` after
  `SizingSection`. Radio `name` = `useId()` (the document-scoped grouping trap).
- **Phase 5** — docs (`README.md`, `high-level-plan.md:93`,
  `SettingsSpec.ts`'s outlineMaxDepth comment, `architecture-map.md`,
  `CHANGELOG.md`, `scripts/setup-dev-vault.sh`), the e2e set §6.L (incl. the
  reviewer's cases 56 and 57), and the §8 follow-up tickets. **No tickets were
  filed in this run.**
- Unchanged by design, still true: `NodeSizer`, `GraphStructureDiff` prod code,
  `NodeOutline.tsx`, `ControlsActions`, `ControlsModel`, `main.ts`,
  `PERSISTED_SHAPE_VERSION`, and all three e2e `toHaveCount(6)` sites.

No `#QUESTION_FOR_HUMAN:` — nothing forced a hack and nothing here departs from
the approved CLARIFICATION.

---

# IMPLEMENTATION — wave B: Phases 3 + 4 (the two UI surfaces)

Scope of this run: **Phase 3 and Phase 4 only**, plus the two wave-A review
SHOULD-FIX items. Phase 5 (docs, e2e, tickets) is deliberately untouched.

Branch `node-content-preference`, 2 more commits, working tree clean:

| Commit | Phase |
|---|---|
| `2ded9db` `feat(node-preview): Preview pill on the settings tab (shared segmented control)` | Phase 3 (+ both SHOULD-FIX items) |
| `c50ed40` `feat(node-preview): Preview pill in the graph controls panel` | Phase 4 |

## VERIFIED results (actually run, not assumed)

- `npm run check` (tsc strict): **exit 0** — after Phase 3 and again after Phase 4.
- `npm test`: **1 failed | 894 passed (895)**; **1 failed file | 67 passed (68)**.
  The single failure is the known-RED, pre-existing
  `SettingsSpec.test.ts > … limits equal the exact shipped baseline`
  (`linkStrengthFactor.max`). Not touched. Wave A finished at 892 passed; wave B
  adds 2 (both in the new `nodePreviewPreferenceMeta.test.ts`) and moves 1.
- `npm run build`: **exit 0**, and the generated `styles.css` contains 15
  `vicinity-graph-segmented` / `vicinity-graph-nodecontents` occurrences —
  proof the new `AUTHORED_CSS_FILES` entry actually reached the bundle
  (plan risk §7.4).
- `npm run test:e2e`: NOT run (release gate, wave C).
- **RED-first evidence**: the new test file's `NODE_PREVIEW_ROW_LABEL` import
  failed `npm run check` with `TS2305: … has no exported member` before the meta
  additions landed (`.tmp/p3-red-tsc.log`). Vitest does not typecheck, so for a
  new *exported constant* the honest RED is the compile error, not a runtime
  assertion — recorded plainly rather than dressed up.

## Phase 3 — settings-tab row + shared copy + CSS

| File | Change |
|---|---|
| `src/view/nodePreviewPreferenceMeta.ts` | **+`NODE_PREVIEW_ROW_LABEL = "Preview"`** and **+`NODE_PREVIEW_ROW_DESCRIPTION`** (exact copy from plan §3.2), added to the module wave A created early (deviation D1 honoured — no second module). |
| `src/view/segmented-control.css` | **NEW.** Block `vicinity-graph-segmented`. ~95 lines incl. the structure diagram + WHYs. |
| `esbuild.config.mjs` | `AUTHORED_CSS_FILES` gains `src/view/segmented-control.css`, appended LAST with the order-insensitivity note. |
| `src/view/VicinityGraphSettingTab.ts` | new module const `NODE_PREVIEW_RADIO_GROUP`; `renderNodeContents()` gains the Preview row **above** Outline depth via `.then((row) => this.addNodePreviewSegmented(row.controlEl))`; new private `addNodePreviewSegmented`; docblock rewritten (the superseded "no enable/disable toggle by design" sentence); the "Outline depth" description's stale image clause removed. |
| `.gitignore` | one-line comment fix: `styles.css`'s source list was still "src/view/graph-view.css" (it is now four files, listed in `AUTHORED_CSS_FILES`). |

Tests: new `src/view/nodePreviewPreferenceMeta.test.ts`, 2 cases —
distinct segment labels, and the row label not colliding with a segment label.
Both guard the **accessible names** of the radiogroups (a `Record` over the union
already makes a *missing* label a compile error; duplicate labels it cannot see,
and duplicates would break both screen-reader disambiguation and wave C's
`getByRole("radio", { name })`).

## Phase 4 — controls-panel section

| File | Change |
|---|---|
| `src/view/NodeContentsSection.tsx` | **NEW.** `<Disclosure summary="Node contents" className="vicinity-graph-nodecontents">` → one `__field` row = visible `Preview` label + the segmented radiogroup. `useId()` for the radio `name`. Writes `planSettingsWrite({ kind: "global-node-preview", value }, ctx)` through `useControlsActions().applySettings`. Fully controlled off `view.nodePreviewPreference`. |
| `src/view/GraphToolbar.tsx` | renders `<NodeContentsSection …>` **between** `SizingSection` and `ForceLayoutSection` (panel order mirrors the tab's card order). |
| `src/view/graph-view.css` | new "Node-contents section (toolbar)" block: `__field` (column, `--size-2-1` gap), `__label` (muted, `--font-ui-smaller`), and two panel-scoped overrides making the shared pill `display: flex` with `flex: 1 1 0` equal-thirds segments. LAYOUT only — the control's look stays in the shared file. |

No test file: the repo has **no jsdom and no React testing library** (vitest
runs in the `node` environment; there is not one `*.test.tsx` in `src/`), so a
React section cannot be rendered in `npm test`. Both surfaces' write paths are
already covered purely (§6.H `planSettingsWrite node preview`); the DOM-level
coverage is e2e §6.L cases 54–57, which belong to Phase 5. Stated plainly rather
than papered over with a test that asserts nothing.

## Exact DOM contract for wave C's e2e selectors

**Settings tab** (inside `.vicinity-graph-settings` → the 3rd
`.vicinity-graph-settings-section`, i.e. the "Node contents" card, as the FIRST
row, above "Outline depth"):

```html
<div class="setting-item">                             <!-- Obsidian's own -->
  <div class="setting-item-info">
    <div class="setting-item-name">Preview</div>
    <div class="setting-item-description">Which preview a node shows … shows that one.</div>
  </div>
  <div class="setting-item-control">
    <div class="vicinity-graph-segmented" role="radiogroup" aria-label="Preview">
      <label class="vicinity-graph-segmented__option" title="Let the note decide: …">
        <input type="radio" name="vicinity-graph-node-preview-settings" value="auto">
        <span class="vicinity-graph-segmented__text">Auto</span>
      </label>
      <!-- then value="outline" / "Outline", then value="image" / "Image" -->
    </div>
  </div>
</div>
```

**Controls panel** (a new `Disclosure`, collapsed by default, between
`Node sizing` and `Force layout`):

```html
<details class="vicinity-graph-disclosure vicinity-graph-nodecontents">
  <summary class="vicinity-graph-disclosure__summary">Node contents</summary>
  <div class="vicinity-graph-disclosure__body">
    <div class="vicinity-graph-nodecontents__field">
      <span class="vicinity-graph-nodecontents__label">Preview</span>
      <div class="vicinity-graph-segmented" role="radiogroup" aria-label="Preview">
        <label class="vicinity-graph-segmented__option" title="Let the note decide.">
          <input type="radio" name="«useId()»" value="auto">
          <span class="vicinity-graph-segmented__text">Auto</span>
        </label>
        <!-- outline, image -->
      </div>
    </div>
  </div>
</details>
```

Notes wave C needs:

- **Option order is always `auto`, `outline`, `image`** — from
  `NODE_PREVIEW_PREFERENCES`, on both surfaces.
- **Two radiogroups can be in the DOM at once** (settings modal open over a
  graph view). Scope every selector: `.vicinity-graph-settings …` for the tab,
  `.vicinity-graph-nodecontents …` for the panel. An unscoped
  `getByRole("radio", { name: "Image" })` will be strict-mode ambiguous.
- The radio is `opacity: 0` but **stretched over its whole segment and never
  `display:none`** — `check()` / `click()` / `toBeChecked()` all work
  (verified in Chromium). Assert state with `toBeChecked()`, never on colours.
- For case 55 (proving `segmented-control.css` reached the DOM), the cheapest
  computed-style probe on `.vicinity-graph-segmented` is
  `overflow === "hidden"` or `borderTopStyle === "solid"`.
- The panel's radio `name` is a React `useId()` value (e.g. `«r0»`) — **never
  select by `name`**; use role + accessible name, or `value=`.
- Keyboard: the group is ONE tab stop; ArrowRight/ArrowLeft move focus **and**
  the selection, which fires `change` and therefore writes. A 3-radio group
  cycles, so ArrowRight from `image` lands back on `auto`.

## The 2 wave-A SHOULD-FIX items — resolved

1. **`GraphStructureDiff.test.ts:47-56` lying comment.** Reworded (I took the
   reviewer's first option — reword, don't strengthen). It now says the test pins
   that nobody adds a `nodePreviewPreference` trigger to `decideLayout`, and
   states explicitly that a `sizePx`↔preview coupling would slip past this
   fixture and needs pinning where `sizePx` is computed. **Not** strengthened
   into a real size-independence test: that assertion belongs to `NodeSizer`, not
   to `decideLayout`, and inventing it here would put the guard in the wrong
   place. → Phase 5 ticket candidate (§ below).
2. **`settingsWritePlan.test.ts:113` misfiled test.** Moved verbatim into a new
   `describe("planSettingsWrite node preview")` immediately after
   `describe("planSettingsWrite outline depth")`. No assertion changed.

## Deviations from the plan (wave B)

- **B1 — the focus ring is on the GROUP, not on `__text`.** The plan's CSS
  sketch put `outline: 2px solid var(--background-modifier-border-focus)` on
  `input:focus-visible + .vicinity-graph-segmented__text`. Two problems, both
  found by actually rendering it: (a) the block's `overflow: hidden` (needed to
  clip the selected fill to the rounded frame) would clip an outward ring, and
  (b) focus normally lands on the **checked** radio, so an accent ring inside the
  accent fill is invisible. The group is the single tab stop, so
  `.vicinity-graph-segmented:has(input:focus-visible) { box-shadow: 0 0 0 2px var(--interactive-accent) }`
  is both correct and the repo's existing focus idiom
  (`graph-view.css:606-609`). It also avoids
  `--background-modifier-border-focus`, a variable this repo has never used.
- **B2 — `--text-on-accent` kept, no fallback.** The plan asked for an eyeball
  before trusting it. There is no Obsidian binary in this container, so I could
  not eyeball it *in Obsidian*; it is a core Obsidian variable (the one
  `.mod-cta` uses) and I judged a `var(--text-on-accent, var(--text-normal))`
  fallback worse than nothing — `--text-normal` on an accent fill is illegible
  in dark themes, so the "fallback" would hide a problem instead of failing
  loudly. Flagged as a wave C eyeball item below.
- **B3 — vertical padding is `--size-4-1`, not the sketch's `--size-2-1`.**
  Measured: `--size-2-1` gave a 21px-tall pill, cramped next to Obsidian's ~24px
  controls and a small click target. `--size-4-1` → 25px.
- **B4 — `.gitignore` comment fixed** (one line, out of the plan's file list). It
  named a single CSS source for a file now generated from four; leaving it would
  have been a doc lie one line away from the change that made it wrong.
- **B5 — the "Outline depth" row description was edited in Phase 3**, not
  Phase 5. The review called it *reachable-stale*, and after the Preview row
  lands directly above it, "Notes whose first image comes before the first
  heading show that image instead" reads as a contradiction of the pill sitting
  next to it. Phase 5 still owns `SettingsSpec.ts:120-124`, `README.md`,
  `high-level-plan.md`, `architecture-map.md`, `CHANGELOG.md` and
  `setup-dev-vault.sh`.
- **Not a deviation, stated for honesty:** the Preview row's `title` tooltips
  carry the per-option descriptions on BOTH surfaces (the plan specified this for
  the tab and implied it for the panel).

## What I verified visually, and what I could NOT

There is **no Obsidian binary and no `OBSIDIAN_PATH`** in this container
(`e2e/obsidianHarness.ts` requires one), so the plan's "dev-vault settings tab in
light AND dark" check was impossible as written. Instead I installed Chromium and
rendered the **real `segmented-control.css` + `graph-view.css`** against a
throwaway harness carrying the exact markup both surfaces build, with Obsidian's
theme variables stubbed at their shipped light/dark values
(`.tmp/segmented-harness.html`, `.tmp/shoot-segmented.mjs`; screenshots in
`.out/segmented-{light,dark}-{auto,image}.png` and
`.out/segmented-light-focus-ring.png`, none source-controlled).

Confirmed by probe, not by eye alone:

| Check | Result |
|---|---|
| ArrowRight moves focus | `auto` → `outline` |
| ArrowRight also moves the SELECTION (so it writes) | `input:checked` = `outline` |
| Focus ring lands on the group and is not clipped | `box-shadow: rgb(139,108,239) 0 0 0 2px` |
| `:has(> input:checked)` fills the label | `background-color: rgb(139,108,239)` |
| `--text-on-accent` applies to the checked segment | `color: rgb(255,255,255)` |
| The stretched input covers its whole segment | `true` (label box == input box) |
| The tab and panel groups are INDEPENDENT (the document-scoped `name` trap) | checking in the panel left the tab's selection intact |
| Pill geometry | tab 170×25px; panel 244×25px (equal thirds at 260px) |

**Still unverified, for wave C / the human:** the same two screens inside a real
Obsidian (theme variables from app.css rather than my stubs — chiefly
`--text-on-accent`), and the live behavioural loop "flip the pill → node
contents change, positions unchanged". `npm run setup:dev-vault` copies the
artifacts, but nothing in this container can open the vault.

## What remains for Phase 5

Unchanged from wave A's list, minus the two items wave B absorbed
(`VicinityGraphSettingTab.ts`'s docblock, and the "Outline depth" description):

1. Docs: `README.md:59-66` + `:137-146`, `high-level-plan.md:93`,
   `SettingsSpec.ts:118-124`, `architecture-map.md` ("Key seams" + the
   `src/adapters/` bullet the reviewer flagged), `CHANGELOG.md` (incl. the
   WHY-NOT for keeping `PERSISTED_SHAPE_VERSION` at 2),
   `scripts/setup-dev-vault.sh:359-368`.
2. e2e §6.L cases 51–57 — use the DOM contract above. Case 56 is now definitely
   needed: `settingsUxVisual.e2e.ts:52-57` hand-enumerates the panel's
   disclosures and **does not yet mention "Node contents"**, so it currently
   under-asserts. I confirmed no existing e2e counts panel disclosures, so
   nothing in the suite goes red from wave B — it just under-covers.
3. Tickets: the plan's §8 set (incl. §8.4 `EDGE_VISIBILITY_MODES`), **plus two
   from wave B**: (a) pin the `sizePx`-independence invariant where `sizePx` is
   computed, the gap SHOULD-FIX 1 exposed; (b) the panel still does not mirror
   the *Outline depth* slider (plan §3.4, deliberately out of scope).
4. `.out/` screenshots from a real Obsidian for the light+dark visual pass.

No `#QUESTION_FOR_HUMAN:` — nothing forced a hack, and nothing here departs from
the approved CLARIFICATION.

---

# IMPLEMENTATION — wave C: Phase 5 (docs, e2e, tickets) + the trough decision

Scope: **plan Phase 5 only**, plus the human's trough decision and wave B's
doc-only SHOULD-FIX. Waves A and B above are unchanged.

Branch `node-content-preference`, 1 commit, working tree clean:

| Commit | Scope |
|---|---|
| `ac27f8d` `feat(node-preview): inset trough + Phase 5 docs, e2e and follow-up tickets` | Phase 5 |

## ⚠️ CORRECTION to waves A and B: **e2e DOES run in this container**

Both earlier waves reported "there is NO Obsidian binary and no `OBSIDIAN_PATH`, so
`npm run test:e2e` cannot run here at all". **That was wrong.** `scripts/run-e2e.sh`
auto-provisions a pinned Obsidian when `OBSIDIAN_PATH` is unset, and a **cached
Obsidian 1.12.7 was already present** at `.tmp/obsidian/obsidian-1.12.7/obsidian`
(`npm run setup:obsidian` printed "using cached binary"). With no display server the
script supplies `--ozone-platform=headless --disable-gpu` on its own. Everything the
earlier waves deferred as "impossible here" — the e2e suite, real-theme colour
measurements, the light/dark screenshots — was in fact available. Recorded plainly
because two waves of "unverified" claims rested on it.

## VERIFIED results (actually run)

- `npm run check` (tsc strict): **exit 0** (`.tmp/wc-check.log`).
- `npm test`: **1 failed | 894 passed (895)**; **1 failed file | 67 passed (68)**
  (`.tmp/wc-test.log`). The one failure is the known-RED, pre-existing
  `SettingsSpec.test.ts > … limits equal the exact shipped baseline`
  (`linkStrengthFactor.max`). Not touched. Identical to wave B's numbers — Phase 5
  adds no vitest tests by design (docs + e2e + tickets).
- `npm run build`: **exit 0**; the generated `styles.css` carries 15
  `vicinity-graph-segmented`/`-nodecontents` occurrences and the new
  `background-modifier-form-field` trough at `:1156`.
- `npx tsc -p e2e/tsconfig.json`: **exit 0** (`npm run check` does NOT cover `e2e/`).
- **`npm run test:e2e` (real Obsidian 1.12.7, headless):** full suite
  **53 passed | 3 failed | 20 did not run** (`.tmp/wc-e2e-full.log`).
  **All 3 failures are pre-existing, ticketed environment flakes, none of them mine:**

  | Failing case | Status |
  |---|---|
  | `vicinityGraph.e2e.ts:160` singleton-folder breadcrumb | already ticketed: `ticket-e2e-gamma-breadcrumb-fails-headless.md` |
  | `edgeRoutingEval.e2e.ts:171` radial layout SKIPS routing | already ticketed: `nid_6lxaenl4oamjxqj6f0eh6rr4c_e` (stale layered/radial references) |
  | `nodeOutline.e2e.ts:92` outline lists its headings | **newly diagnosed by me**, ticketed: `ticket-e2e-headless-culling-unmounts-main-node.md` |

  The "20 did not run" are the cases after each failure in a `serial` file.

- **All 9 of my new e2e cases pass.** The 6 in `settingsUxVisual.e2e.ts` passed in the
  FULL suite run (cases 51–56 of `.tmp/wc-e2e-full.log`, and again 8–13 in
  `.tmp/wc-e2e-ux2.log`). The 3 in `nodeOutline.e2e.ts` are blocked in a full-file run
  by that file's pre-existing red FIRST case (serial mode), so I verified them in
  isolation: `npm run test:e2e -- nodeOutline.e2e.ts --grep "Preview preference|document position decides again"` → **3 passed** (`.tmp/wc-e2e-new3.log`).

### The `nodeOutline.e2e.ts:92` failure — diagnosed, not hand-waved

I did **not** assume it was pre-existing. Evidence, in order:

1. It **passed** on the very first run in this container (11/11 in 2.8s).
2. It then failed 4 runs in a row — **including two runs on a `git stash`-ed,
   pristine tree** (11 tests, not 14 ⇒ the stash really was in effect). So it is not
   my regression.
3. A throwaway probe spec sampled the DOM every 1.5s:
   `t0` → `["outline-note.md:main:outline", "outline-cover.md:regular:thumbnail"]`,
   `nodeHeight: 160`; `t1500`…`t6000` → outline-note.md is **GONE**, and never returns.
   `headings.length = 13` and the controller are healthy throughout.
   ⇒ the preview decision is CORRECT; React Flow's culling **unmounts** the MAIN node
   after a later layout pass moves it out of the small headless pane, and `fitView`
   only runs on mount. Same family as `ticket-e2e-node-click-flaky-headless.md` /
   `ticket-viewport-culling-visual-smoke.md`.

**No test was weakened, skipped or retried to manufacture green.** My three new cases
go through a documented local helper, `showNoteWithRefitGraph()`, which calls the
harness's existing `remountGraphView()` (a real user action: reopen the view) so they
observe a re-fitted graph. Assertions are untouched. The file's pre-existing cases
were deliberately left alone, so `nodeOutline.e2e.ts` still goes red here — an honest
red, with a ticket, rather than a patched-over green.

## Item 1 — the trough (HUMAN DECISION, implemented)

`src/view/segmented-control.css`: `background: var(--background-primary)` →
`var(--background-modifier-form-field)`, with a WHY/WHY-NOT comment. Then I
**measured it**, twice, rather than asserting it works:

- **In Obsidian 1.12.7's real `app.css`** (extracted from `resources/obsidian.asar`):
  `body { --background-modifier-form-field: var(--color-base-00) }` and
  `.theme-dark { … : var(--color-base-25) }`, while `--background-primary` is
  `var(--color-base-00)` in both.
- **In a running Obsidian**, via the new e2e case's computed-style probe:

  | | trough | selected fill | selected text | unselected text |
  |---|---|---|---|---|
  | dark | `rgb(42,42,42)` | `rgb(138,92,245)` | `rgb(255,255,255)` | `rgb(179,179,179)` |
  | light | `rgb(255,255,255)` | `rgb(152,115,247)` | `rgb(255,255,255)` | `rgb(92,92,92)` |

**Honest consequence, stated up front:** in the **default LIGHT theme the change is a
visual no-op** — `--background-modifier-form-field` resolves to the page colour there.
That is Obsidian's own choice (its light-theme `input[type=text]` is likewise
hairline-framed), so the pill now matches native inputs in *both* themes, which is what
the decision was for; dark themes gain a genuine inset. The CSS comment says exactly
this so nobody "re-fixes" it. The selected accent fill reads clearly against the new
trough in both themes (`selectedFill !== trough` is now asserted, not just eyeballed).

**Bonus: deviation B2 is largely retired.** `--text-on-accent` resolves to
`rgb(255,255,255)` in both default themes — measured, no longer a hope. White on that
accent is ≈3.4:1, below AA for body text, but it is Obsidian's OWN
accent/`--text-on-accent` pairing (every `.mod-cta` button), so deviating would make
our control the odd one out. Third-party themes remain a human check.

## Item 2 — the corrected DOM contract (wave B SHOULD-FIX)

Wave B's contract above is accurate but omitted the timing asymmetry. **Correction,
which governs how wave C's selectors are written:**

- **Settings tab — UNCONTROLLED.** `VicinityGraphSettingTab.addNodePreviewSegmented`
  builds plain DOM radios; `.checked` flips **synchronously** with the click.
- **Controls panel — CONTROLLED.** `NodeContentsSection.tsx` sets `checked` from
  `view.nodePreviewPreference`, i.e. from the rebuilt snapshot. Immediately after
  `click()`/`check()` the DOM still reports the **OLD** value until
  persist → rebuild → re-render completes.

⇒ every panel-side assertion **must** be an auto-retrying `expect(locator)` /
`expect.poll(...)`. A one-shot `isChecked()`, `evaluate(el => el.checked)`,
`inputValue()` or computed-style sample taken in the same tick is flaky **by
construction**. Also: use `.click()`, not `.check()`, on the panel radio —
`check()`'s post-action "is it checked now" verification races the rebuild.
This is written into `settingsUxVisual.e2e.ts` as a block comment above the new
cases, so the constraint lives next to the code it constrains.

## Phase 5 work delivered

### Docs — superseded, NOT contradicted (position still decides, under `Auto`)

| File | Change |
|---|---|
| `README.md` | Global-defaults list: new **Preview** bullet (3 values, default `Auto`, both surfaces); *Outline depth*'s "There is no on/off switch" narrowed to the depth field. *Node contents* section rewritten: the pill picks, `Auto` = the old document-position rule **with the escape hatch intact**, plus the never-empties-a-node fallback. |
| `docs-internal/plan/high-level-plan.md` | The load-bearing `:93` paragraph now names the global three-way setting, states that `Auto` (the default) still means document position, and adds a second bullet on **where the decision lives** (adapter reports the fact, `nodePreviewChoice` owns the rule, `sizePx` stays independent). |
| `src/engine/SettingsSpec.ts` | The last surviving "no on/off switch (CLARIFICATION Q2)" comment (`outlineMaxDepth`) reconciled — depth is not the switch; `nodePreviewPreference` is, and its `auto` default keeps position deciding. **`grep -rn "CLARIFICATION Q2" src/` now returns only unrelated Q2 references** (canvas detection, ctrl/cmd-click, depth-stepper bounds) — verified, this was the only leftover. |
| `docs-internal/architecture-map.md` | "Key seams": `LinkProvider` reports **facts, not decisions** (`imagePrecedesOutline`), and `view/nodePreviewChoice.ts` alone owns the precedence. |
| `scripts/setup-dev-vault.sh` | The outline check qualified with "at the DEFAULT Preview = Auto", plus a new Preview-pill checklist (both surfaces, the two overrides, no-node-movement, light/dark legibility). |
| `docs-internal/CHANGELOG.md` | New top entry, incl. the WHY-NOT for keeping `PERSISTED_SHAPE_VERSION` at 2, and explicitly marking the previous entry's "positional, **not** a preference" as superseded rather than reversed. |

### e2e (+9 cases; 1 harness helper)

- **`e2e/obsidianHarness.ts`** — new `setNodePreviewPreference()`, mirroring
  `setGlobalNodeCap`/`setMaxNodeSizePx`, plus `refreshOpenViews()` (a store write alone
  rebuilds nothing).
- **`e2e/nodeOutline.e2e.ts`** — plan cases 51–53, as section **E8**:
  Outline makes an image-first note show its outline (with the positional result
  asserted first as the precondition, so the flip is real); Image makes an
  outline-first note show its thumbnail; back on Auto, position decides again.
  **Deviation C1:** placed between E6 and E7, not appended last as the plan said —
  E7 shrinks every node below the 104px threshold, so nothing after it can observe a
  rendered preview at all. E6 conveniently leaves outline-cover as MAIN, and case 53
  restores `auto` **in the test body** (not `afterAll`), so E7 still runs under Auto
  exactly as before.
- **`e2e/settingsUxVisual.e2e.ts`** — plan cases 54–57 delivered as 6 BDD cases: the
  tab pill offers 3 options and checks the stored one; clicking a segment persists;
  `segmented-control.css` reaches the settings DOM (`overflow: hidden` — unique to that
  file, unlike the pre-existing `borderTopStyle` probe which `settings-tab.css` also
  satisfies); the selected segment is filled distinctly from the trough (+ light/dark
  screenshots into `.out/settings-ux/` and the colour table above);
  **the PANEL pill writes the same global** (case 57 — previously the panel half had
  zero coverage at any level); and the panel pill re-checks itself from the rebuilt
  snapshot. Case 56 folded into the existing panel-defaults test as
  `expect(disclosure("Node contents")).not.toHaveAttribute("open", "")`.
- **`e2e/settingsResetReview.e2e.ts`** — `nodePreviewPreference` added to the `Globals`
  type, set to `"image"` in `dirtyEverySection()` (so the isolation assertions are
  non-vacuous), asserted back to `"auto"` by the Node contents reset **and** by
  restore-all, and asserted still `"image"` after each of the other five section resets.
- **Enumeration baselines checked, not blindly edited:** the three
  `.vicinity-graph-settings-section` `toHaveCount(6)` sites are **still correct** — the
  Preview row joined the existing Node contents card, no seventh card exists — and were
  left byte-identical, as were both reset-button name lists. Confirmed by the suite
  passing them. `settingsResetVerify.e2e.ts` needed no edit at all.

### Tickets filed

**`docs-internal/tickets/`** (repo convention; referenced from code + CHANGELOG):

| Path | What |
|---|---|
| `docs-internal/tickets/ticket-node-preview-pill-human-smoke-run.md` | The human's real-Obsidian pass. Narrowed to what automation could NOT settle: a **third-party theme**, the focus-ring-vs-fill same-colour taste call, and 260px-panel ellipsis. Records the measured default-theme colours so nobody re-derives them. |
| `docs-internal/tickets/ticket-e2e-headless-culling-unmounts-main-node.md` | The culling flake, with the full probe transcript, the three candidate fixes, and "prove it with five consecutive green runs" as the acceptance bar. Names the `showNoteWithRefitGraph()` workaround so it gets deleted with the fix. |

**`_tickets/` via the `ticket` CLI** (the tracked store the repo's current
engineering follow-ups live in — `ticket ls`):

| id | What |
|---|---|
| `nid_f8csd65emmy6p62ad9x5w1psz_e` | Pin the `sizePx`-independence invariant where `sizePx` is computed — the gap wave B's SHOULD-FIX 1 exposed and could not close in `GraphStructureDiff.test.ts`. |
| `nid_abreq4lmpo8vnvf61y9k9yly0_e` | `SettingsSpec.test.ts`'s "exact shipped baseline" omits `outlineMaxDepth` (plan §8.1). **Re-verified before filing** — still true; `nodePreviewPreference` IS on both sides. |
| `nid_klkdpmx6axf90y4xj8khwrlf2_e` | Controls panel: mirror the *Outline depth* slider in the new disclosure (plan §8.2). |
| `nid_3k0a4zl6in0mj8lcjibkjq2dx_e` | `EDGE_VISIBILITY_MODES` re-lists a union in persistence with no completeness guard (plan §8.4). |
| `nid_3399ajdcy5lq21lx5v0jxh9i4_e` | The e2e section-count / reset-name baseline **triplication**. The plan said "already ticketed elsewhere — do not duplicate"; I checked both stores and **no such ticket existed**, so I filed it. |
| `nid_u36pqr4zljs44jt42lk9ln8ry_e` | A controls-panel write does not fan out to OTHER open graph views (review suggestion 4). Pre-existing, but the controlled pill makes it show as a wrong selected segment. |

## Deviations (wave C)

- **C1 — e2e cases 51–53 sit between E6 and E7**, not appended last. Reason above
  (E7 shrinks every node out of the outline band). Case 53 restores the default in its
  own body, which is strictly safer than the plan's `afterAll` for a serial file.
- **C2 — plan case 54 split into two BDD cases** ("offers 3 options and checks the
  stored one" / "clicking persists"), and each seeds the store as its explicit GIVEN
  instead of inheriting whatever an earlier test left. The shipped default being `auto`
  is already pinned by `SettingsSpec.test.ts`; re-testing it through the DOM would have
  made the case depend on test order.
- **C3 — one extra case beyond the plan** ("the panel pill re-checks itself from the
  rebuilt snapshot"). It is the only thing that pins the *controlled* half of the DOM
  contract corrected in Item 2, and it costs 3 lines.
- **C4 — `showNoteWithRefitGraph()` helper** added to `nodeOutline.e2e.ts` for the
  pre-existing culling flake. Not a plan item; without it the new cases could not be
  observed at all in this environment. No assertion changed, and the helper's docblock
  points at its ticket for deletion.
- **C5 — the trough comment carries the measured `app.css` values.** More than the
  human asked for, but the light-theme no-op is exactly the kind of thing a future
  maintainer would otherwise "fix" back.

## What is left for the human

1. **`docs-internal/tickets/ticket-node-preview-pill-human-smoke-run.md`** — one pass
   under your own theme. The default-theme colours are already measured and recorded;
   what's genuinely open is a third-party theme plus two taste calls (focus ring shares
   `--interactive-accent` with the selected fill; 260px panel ellipsis).
2. **`nodeOutline.e2e.ts` is red in a headless container** (its pre-existing FIRST
   case). Diagnosed and ticketed, not mine, and deliberately not patched — the fix is a
   harness/product decision. It presumably passes on a real desktop window.
3. `npm test` still carries the one author-only known-RED `linkStrengthFactor.max`.
4. The `change_log` CLI entry is TOP_LEVEL_AGENT's, not mine.

No `#QUESTION_FOR_HUMAN:` — nothing forced a hack, nothing departs from the approved
CLARIFICATION, and the one visual judgement call was the human's own decision, which I
implemented and then measured.
