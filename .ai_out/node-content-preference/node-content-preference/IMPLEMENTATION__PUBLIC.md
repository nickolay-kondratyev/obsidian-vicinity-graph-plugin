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
