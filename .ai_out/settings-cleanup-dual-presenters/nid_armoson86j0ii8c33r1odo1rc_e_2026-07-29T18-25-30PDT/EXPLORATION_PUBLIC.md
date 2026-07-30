# EXPLORATION — dual presenters (ticket 4, `nid_armoson86j0ii8c33r1odo1rc_e`)

All paths absolute-relative to repo root `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin`.
Line refs are as of `83c537d` (HEAD at exploration time). **Baseline is GREEN**: `npm test` → 85 files / 1124 tests passed, exit 0; `npm run check` → exit 0 (logs: `.tmp/explore_npm_test.log`, `.tmp/explore_npm_check.log`).

> ⚠️ The descriptor-model ticket's own `EXPLORATION_PUBLIC__3_ui_tests.md` §1/§4 tables are now **STALE** (they predate per-doc removal: `CentralDepthControls.tsx` is gone, depth copy changed to "Depth (all notes)", reset copy dropped the per-note clauses). Use the tables in this document instead.

---

## 0. What already landed (so this ticket does not redo it)

- **Ticket 2 (descriptor model)** — `src/view/settingsSectionFields.ts` (section→field map, compile-guarded), spec completeness guards in `src/engine/SettingsSpec.ts`, `ParsedViewFields` in `src/persistence/persistedShapes.ts`, `SIZING_METRICS` completeness, reset plans derived from the section map.
- **Ticket 2.5 (global-only)** — `CentralDepthControls.tsx`, per-doc stores, `NOT_PERSISTABLE_NOTICE` on depth, and the "Pinned centrals (n)" panel disclosure are **all deleted**. `src/view/GlobalDepthControls.tsx` replaced them. Confirmed: `grep -rn "Pinned centrals" src/` → **zero hits** (only two e2e prose comments remain: `e2e/settingsBaseline.ts:127`, `e2e/settingsUxVisual.e2e.ts:94`).
- **Ticket 3 (write pipeline)** — `src/view/settingsWritePipeline.ts` is the one write path; both surfaces already route through it. **Nothing about writes needs re-plumbing in this ticket.**

---

## 1. The E1 descriptor model as it exists TODAY

There is **no single row/field descriptor object**. What exists is a *family of five compile-guarded tables*, keyed by field, that ticket 4 must unify (or layer a row model over):

| Table | File:line | Keyed by | Carries |
|---|---|---|---|
| `SETTINGS_SPEC` | `src/engine/SettingsSpec.ts:159-354` | nested `globalDepths` / `globalView` / `nodeExclusion` | `default`, `min`, `max`, `step` per leaf |
| `SECTION_SETTINGS_FIELDS` | `src/view/settingsSectionFields.ts:46-53` | the six sections × 3 family columns | which `keyof ViewSettings` / `keyof DepthSettings` / `keyof NodeExclusionSettings` each section owns |
| `SETTINGS_RESET_SCOPES` | `src/view/settingsResetPlan.ts:128-208` | `SettingsResetScope` = `SettingsSection \| "all"` | `label`, `description`, `plan(ctx)`, optional `confirmation(ctx)` |
| `FORCE_LAYOUT_FIELD_META` + `_MAIN_FIELDS` / `_ADVANCED_FIELDS` | `src/view/forceLayoutFieldMeta.ts:16-65` | `keyof ForceLayoutSettings` | `label`, `description`; main/advanced grouping |
| `SIZING_METRICS` | `src/view/sizingMetrics.ts:21-27` | order-bearing array of `{id,label}` | metric row labels + order |
| `NODE_PREVIEW_ROW_LABEL` / `..._ROW_DESCRIPTION` / `NODE_PREVIEW_OPTION_META` | `src/view/nodePreviewPreferenceMeta.ts:16,23,40` | row copy (2 consts) + per-`NodePreviewPreference` option copy | see §2 |

Derivations (each one-way, from the spec):

- **Defaults**: `EngineDefaults` (`src/engine/constants.ts:229`) + `DEFAULT_*` consts (`constants.ts:20-31`) read `.default`.
- **Bounds/clamps**: `FORCE_LAYOUT_RANGES` (`constants.ts:154`), `SIZING_RANGES` (`constants.ts:182`, keyed by `SizingRangeField = Exclude<keyof SizingSpec,"metrics">` at `:180`), `MIN_NODE_CAP` `:34`, `MIN/MAX_OUTLINE_DEPTH` `:37-38`, `MIN/MAX_STEPPER_DEPTH` `:55-56`; clamps `clampOutlineMaxDepth` `:46`, `clampForceLayoutSettings` `:159`, `clampSizingNumber` `:194`, `clampSizingSettings` `:209`, `clampStepperDepth` (`src/view/constants.ts:252`).
- **Parse**: `src/persistence/persistedShapes.ts` — `ParsedViewFields` mapped type makes an unparsed field a TS2741.
- **Write plan**: `src/view/settingsWritePlan.ts` — `SettingsInteraction` union (10 arms, `:35-59`) → `planSettingsWrite` exhaustive switch (`:77-106`) → `SettingsCommand` (3 kinds, `:62-68`).
- **Reset scope**: `planSectionReset` (`settingsResetPlan.ts:105-127`) derives each card's reset from `SECTION_SETTINGS_FIELDS`.

Compile guards to **not weaken** (the standing acceptance bar per `docs-internal/notes/settings.md`):
`_assertEverySettingsFieldSpecced` / `_assertNoOrphanSpecField` (`SettingsSpec.ts:118,127`), `_assertEverySettingsFieldSectioned` (`settingsSectionFields.ts:73`), `_assertEverySizingMetricListed` (`sizingMetrics.ts:40`), `_assertEveryForceLayoutFieldGrouped` (`forceLayoutFieldMeta.ts:74`), `_assertEveryResetScopePlaced` (`settingsResetPlan.ts:248`, tautological-by-construction, documented as retained), `ParsedViewFields`.

---

## 2. `settingsSectionFields.ts` and `nodePreviewPreferenceMeta.ts` shapes

**`src/view/settingsSectionFields.ts`** (75 lines)
```ts
export const SETTINGS_SECTIONS = ["depth-defaults","node-sizing","node-contents","force-layout","node-exclusion","performance"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export interface SectionSettingsFields {
  readonly view:      readonly (keyof ViewSettings)[];
  readonly depth:     readonly (keyof DepthSettings)[];
  readonly exclusion: readonly (keyof NodeExclusionSettings)[];
}
export const SECTION_SETTINGS_FIELDS = { … } as const satisfies Readonly<Record<SettingsSection, SectionSettingsFields>>;
```
Current contents (`:47-52`):
| section | view | depth | exclusion |
|---|---|---|---|
| `depth-defaults` | — | `outgoingDepth`,`incomingDepth` | — |
| `node-sizing` | `sizing` | — | — |
| `node-contents` | `outlineMaxDepth`,`nodePreviewPreference` | — | — |
| `force-layout` | `forceLayout` | — | — |
| `node-exclusion` | — | — | `enabled`,`patterns` |
| `performance` | `nodeCap` | — | — |

**Ticket-2 directive (recorded in this ticket's Notes)**: extend this **per-family COLUMN shape** (add e.g. a row/copy column keyed by the same `keyof`), do **NOT** invent a `{family, key}` row union. The three families land in three different `SettingsCommand` kinds and are consumed by three separately-typed `restoreFields<T>` calls — a row union would be re-grouped by family at every consumer. `as const satisfies` (not a plain annotation) is what preserves the literal key tuples the guard at `:65-75` reads; a plain annotation makes the guard vacuous.

**`src/view/nodePreviewPreferenceMeta.ts`** (53 lines)
- `NODE_PREVIEW_ROW_LABEL = "Preview"` (`:16`) and `NODE_PREVIEW_ROW_DESCRIPTION` (`:23-25`) — **row copy for the `keyof ViewSettings` field `nodePreviewPreference`. These MOVE into this ticket's row model.**
- `NODE_PREVIEW_OPTION_META: Readonly<Record<NodePreviewPreference, {label, description}>>` (`:40-53`) — keyed by the *value* union, not by a field. **Stays where it is.** Render order comes from `NODE_PREVIEW_PREFERENCES` (engine), never `Object.keys`.
- Consumed by: tab (`VicinityGraphSettingTab.ts:24-27,579-580,614`), panel (`NodeContentsSection.tsx:7,45,46,48`), and `settingsResetPlan.ts:2,146` (the node-contents reset description interpolates `NODE_PREVIEW_OPTION_META[default].label`).

---

## 3. Settings tab renderer — every row, in order

`src/view/VicinityGraphSettingTab.ts` (792 lines). `display()` at `:169-183` hand-calls seven methods in a literal order. Card frame = `createSection()` `:254`; each card ends with `addSectionReset()` `:265-280`.

**a11y convention (one rule, stated at `:123-161`)**: every control carries `aria-label` == the row name a sighted user reads, plus a role suffix when one row holds two controls. `nameControl(el, name)` `:137`; `nameToggle(toggle, name)` `:156` (must target the inner `<input>` — `toggleEl` is the wrapping `<label class="checkbox-container">`). Note at `:133-135`: Obsidian pops its own hover tooltip for any `aria-label`, so named controls get a tooltip free — which is why nothing calls `setTooltip` except the reset buttons.

| # | Card heading (`setHeading()`) | Row | Control kind | Row name / a11y name | Method:line | Write |
|---|---|---|---|---|---|---|
| 1 | **Depth (all notes)** `:462` | Outgoing depth | slider 0–5 step 1 | `Outgoing depth` | `renderDepthDefaults` `:456-479` → `addDepthSlider` `:698-715` → `addLabeledSlider` `:677-696` | `{kind:"global-depth",direction:"outgoing",value:clampStepperDepth(v)}` |
| 1 | | Incoming depth | slider 0–5 step 1 | `Incoming depth` | same | `direction:"incoming"` |
| 1 | | Restore depth defaults | button | `Restore depth defaults` (aria + tooltip) | `addSectionReset(section,"depth-defaults")` `:478` | `writes.restoreDefaults("depth-defaults")` |
| 2 | **Node sizing** `:483` | (desc-only row, no control) `:484-486` | — | — | `renderSizing` `:481-497` | — |
| 2 | | 5 metric rows (Own file size, Total linker size, Backlinks, Outlinks, Depth decay) | toggle **+** number in ONE `Setting` | `"<label> enabled"` / `"<label> weight"` | `addSizingMetricRow` `:506-559` | `global-sizing-metric-enabled` `:535`; `global-sizing-metric-weight` `:555` (debounced) |
| 2 | | Minimum node size (px) | number, range `SIZING_RANGES.minPx` | `Minimum node size (px)` | `addSizingNumber` `:725-761` | `global-sizing-number` via `SizingRowWrite` |
| 2 | | Maximum node size (px) | number | `Maximum node size (px)` | same | same |
| 2 | | Depth decay k | number | `Depth decay k` | same | same |
| 2 | | Restore node sizing defaults | button | — | `:496` | — |
| 3 | **Node contents** `:577` | Preview | 3 native radios in `role="radiogroup"` `aria-label="Preview"`; each `<label>` wraps its radio, `title`=option description | group named `Preview`; each radio named by its visible text | `renderNodeContents` `:575-593`, `addNodePreviewSegmented` `:607-632` | `global-node-preview` `:629` |
| 3 | | Outline depth | slider 1–6 step 1 | `Outline depth` | `:582-591` | `global-outline-depth` with `clampOutlineMaxDepth` |
| 3 | | Restore node contents defaults | button | — | `:592` | — |
| 4 | **Force layout** `:336` | 4 main sliders (Center force, Repel force, Link force, Link distance) | slider, bounds `FORCE_LAYOUT_RANGES[field]` | `meta.label` | `renderForceLayout` `:334-346`, `addForceLayoutSlider` `:776-790` | `global-force-layout-field` |
| 4 | | `<details class="vicinity-graph-settings-advanced">` **"Advanced spacing"** `:340-341` | native details/summary (hand-rolled: Setting API has no collapsible) | — | `:340-344` | — |
| 4 | | 3 advanced sliders (Node spacing, Group member spacing, Edge clearance) | slider | `meta.label` | `:342-344` | same |
| 4 | | Restore force layout defaults | button | — | `:345` | — |
| 5 | **Node exclusion** `:362` | Exclude notes from the graph | toggle | `Exclude notes from the graph` | `renderExclusion` `:360-391` | `global-exclusion-enabled` `:385` |
| 5 | | **Exclusion patterns** — ⚠ **CONDITIONAL** | textarea (4 rows) + `role="status"` feedback slot | `Exclusion patterns` | `showExclusionPatterns` `:415-423` / `addExclusionPatterns` `:425-454` | `global-exclusion-patterns` `:450` (debounced) |
| 5 | | Restore node exclusion defaults | button (confirms if patterns exist) | — | `:390` | — |
| 6 | **Performance** `:636` | Node cap | number, `min=MIN_NODE_CAP`, `step=1` (no max — ticket `nid_aau4r0sj8oudhi711qr9j5x1l_e`) | `Node cap` | `renderPerformance` `:634-659` | `global-cap` `:651` (debounced) |
| 6 | | Restore performance defaults | button | — | `:658` | — |
| — | (footer, OUTSIDE every card, `.vicinity-graph-settings-reset-all`) | Restore all Vicinity Graph settings | button, always confirms | `Restore all Vicinity Graph settings` | `renderRestoreAll` `:308-321` | `restoreDefaults("all")` |

### Hand-written conditional / disable / hide branching (exactly three sites)

1. **HIDE — exclusion patterns row.** `patternsSlot = section.createDiv()` `:372`; `showExclusionPatterns(slot)` `:415-423` empties the slot and re-adds the row only when `exclusion.enabled`. Called at `:386` (after the toggle's await) and `:389` (initial). Docblock `:393-413` carries the WHY-NOT that points at ticket `nid_qp56jugz8en8wkgjirwcb269p_e` — **this comment must be REPLACED** (ticket says "the WHY-NOT comment at ~403"). **Owner decision: always render, `setDisabled(!enabled)`, delete the slot indirection.**
2. **DISABLE — sizing metric weight input.** `weightInput.setDisabled(!enabled)` `:531` inside the toggle handler; initial seed `text.setDisabled(!seed.enabled)` `:545`. **This is the pattern the exclusion row must adopt** (same file, one card away — cited by the ticket as `:530,552`, now `:531,545`).
3. **No other branching.** No dropdowns anywhere in the tab (`addDropdown` is never called). No hidden cards.

### Write-pipeline call shape (tab)

- `this.writes` getter `:119-121` → `plugin.settingsWrites` (the one `SettingsWritePipeline`).
- Instant controls: `void this.writes.apply(interaction)` (sliders, toggles, radios).
- Typed controls: `this.debounced.schedule(rowName, (writer) => writer.apply(interaction))` — `DebouncedSettingsWrites` (`src/view/settingsDebounce.ts:50`), keyed by the **row's visible name** (`:84-90` — "already unique per row, and already the control's accessible name, so there is no parallel id table"). `this.debounced.drop(name)` on half-typed input. `flushOnBlur(input)` `:198-202`. `settlePendingWrites()` `:213-219`.
- Resets: `requestReset(scope)` `:288-301` → `writes.planResetConfirmation(scope)` → `ConfirmModal` or `this.resets.run(scope)` (`SettingsResetSequence`, `src/view/settingsResetSequence.ts`).

---

## 4. In-graph React panel — every section and control

Root: `src/view/VicinityGraphFlow.tsx:119-121` mounts `<Panel position="top-left"><GraphToolbar controls={snapshot.controls}/></Panel>` inside `ControlsActionsContext.Provider`.

`src/view/GraphToolbar.tsx` (55 lines) — outer `<details class="vicinity-graph-toolbar nowheel nodrag nopan">` with summary "Graph controls" `:29-32`; body `.vicinity-graph-toolbar__body` `:33`. Five top-level `<Disclosure>` children, hand-listed in JSX order `:41-51`:

| # | Disclosure summary | Open by default | Component | Controls rendered |
|---|---|---|---|---|
| 1 | **Depth (all notes)** | ✅ `defaultOpen` `:41` | inline `Disclosure` + `GlobalDepthControls.tsx` | 2 `DepthStepper`s labelled **"Outgoing"** / **"Incoming"** |
| 2 | **Node exclusion** (+ optional count badge) | ✗ | `NodeExclusionSection.tsx` | `ToggleSwitch` labelled **"Exclude notes"**; read-only `<ul aria-label="Exclusion patterns">` of `<code>` when enabled; hint text otherwise |
| 3 | **Node sizing** | ✗ | `SizingSection.tsx` | 5 `SizingMetricRow` (checkbox in a wrapping `<label>` + number `aria-label="<label> weight"` `title="Weight"`); 3 `SizingNumber` — **"Min px" / "Max px" / "Depth decay k"** |
| 4 | **Node contents** | ✗ | `NodeContentsSection.tsx` | Preview pill only: `<span>` label "Preview" + `role="radiogroup" aria-label="Preview"` with 3 radios (`name={useId()}`), each option `title`=description |
| 5 | **Force layout** | ✗ | `ForceLayoutSection.tsx` | 4 main `ForceLayoutSlider`s; nested `<Disclosure summary="Advanced spacing" className="vicinity-graph-forcelayout__advanced">` with 3 more; then a **"Restore defaults"** `<button>` |

Component files and their exact a11y attributes:

- `src/view/Disclosure.tsx` (38) — `<details class="vicinity-graph-disclosure [extra]"><summary class="vicinity-graph-disclosure__summary">…<div class="vicinity-graph-disclosure__body [extra]">`. `defaultOpen` only affects first render (`:10-13`).
- `src/view/GlobalDepthControls.tsx` (35) — `div.vicinity-graph-depth-controls`; `apply(direction,value)` → `actions.applySettings({kind:"global-depth",direction,value})` `:18-19`. **No clamping here** (the stepper clamps).
- `src/view/DepthStepper.tsx` (65) — `−`/value/`+`. `aria-label={`Decrease ${label.toLowerCase()} depth`}` `:44` and `Increase …` `:57`; value in `<span aria-live="polite">` `:50`; buttons disabled at `MIN/MAX_STEPPER_DEPTH`; `clampStepperDepth`. Steps from `shown` (optimistic), not the `value` prop.
- `src/view/NodeExclusionSection.tsx` (78) — `ToggleSwitch checked … ariaLabel="Exclude notes"` `:57`; visible `<span>Exclude notes</span>` `:56`; count badge `title={`${n} node(s) excluded from this graph`}` `:47`; hints `:71,74`.
- `src/view/ToggleSwitch.tsx` (32) — reuses Obsidian's own `checkbox-container mod-small [is-enabled]` markup contract with a real `<input type=checkbox aria-label=…>`.
- `src/view/SizingSection.tsx` (134) — `SizingMetricRow` `:49-92`: `<label class="vicinity-graph-sizing__toggle"><input type=checkbox …/><span>{label}</span></label>` (**checkbox has NO explicit `aria-label`** — implicit from the wrapping label) + weight `<input aria-label={`${label} weight`} title="Weight">` `:76-77`. `SizingNumber` `:100-134`: `<label class="vicinity-graph-sizing__field"><span>{label}</span><input type=number …/></label>` — ⚠️ **NO `aria-label` on the input** (a11y ticket item 1, cited as `SizingSection.tsx:116-126`; its twin at `:53-67` is the metric toggle). No feedback / rejection UI at all (unlike the tab's `SizingRowWrite`) — that gap is satellite `nid_hatwq2jlkhno5t6awcz0q6t9q_e`.
- `src/view/ForceLayoutSection.tsx` (109) — `ForceLayoutSlider` `:73-108`: `<label class="vicinity-graph-forcelayout__field" title={meta.description}>` + `<span class="…__label">{meta.label}</span>` + `<span class="…__value">{shown}</span>` (inline value readout, replaces the tab's hover tooltip) + `<input type=range class="slider" aria-label={meta.label}>`. Restore button `:55-62`: text "Restore defaults", `title="Reset all force layout sliders to their shipped defaults."`, **no `aria-label`** (a11y ticket item 2, cited as `:53-60`), `onClick → actions.restoreDefaults("force-layout")` `:44` (already the shared plan since ticket 2).
- `src/view/NodeContentsSection.tsx` (74) — docblock `:23-24` states the outline-depth omission; **that docblock must be updated** by the mirror ticket.

### Write-pipeline call shape (panel)

Every control calls `useControlsActions()` (`src/view/ControlsActionsContext.ts`) → `ControlsActionsPort` (`src/view/viewPorts.ts:47-56`: `applySettings(interaction)`, `restoreDefaults(scope)`, `pinNode`, `unpinNode`) → `src/view/ControlsActions.ts:43-55` → the SAME `SettingsWritePipeline`. Seed values come from `ControlsModel` (`src/view/ControlsModel.ts:13-35`: `mainPinned`, `globalDepths`, `globalView`, `nodeExclusion`, `excludedNodeCount`). Panel controls wrap their value in `useOptimisticValue` (`src/view/useOptimisticValue.ts:29`), passing the SAME clamp the write path applies where one exists. **The panel has no debounce** (the tab's `DebouncedSettingsWrites` is tab-only).

---

## 5. The DELTA between the two surfaces

### Fields with a row on one surface only

| Field | Tab | Panel | Ticket |
|---|---|---|---|
| `outlineMaxDepth` | ✅ slider "Outline depth" | ❌ **missing** | `nid_klkdpmx6axf90y4xj8khwrlf2_e` (add below the Preview row, idiom = `ForceLayoutSlider`) |
| `nodeCap` | ✅ "Node cap" | ❌ no Performance section at all | not ticketed |
| `nodeExclusion.patterns` | ✅ editable textarea + live regex feedback | 🟡 read-only `<ul>` + "edited in the plugin settings" hint | by design |
| everything else (`outgoingDepth`, `incomingDepth`, 5 sizing metrics ×2, `minPx`, `maxPx`, `depthDecayK`, 7 force-layout, `nodePreviewPreference`, `nodeExclusion.enabled`) | ✅ | ✅ | — |

### Reset affordances
Tab: **7** (6 scoped + 1 tab-wide). Panel: **1** ("Restore defaults" inside Force layout). No panel reset for depth / sizing / contents / exclusion.

### Copy & a11y wording drift (verbatim)

| Concept | Tab string | Panel string | Drift |
|---|---|---|---|
| Depth group heading | `"Depth (all notes)"` | `"Depth (all notes)"` | ✅ aligned (deliberate, owner 2026-07-29) |
| Depth row labels | `"Outgoing depth"` / `"Incoming depth"` | `"Outgoing"` / `"Incoming"` | ⚠️ label drift |
| Depth control a11y | slider `aria-label="Outgoing depth"` | buttons `"Decrease outgoing depth"` / `"Increase outgoing depth"` | different idiom (justified: 2 buttons per row) |
| Exclusion enable | row `"Exclude notes from the graph"` | `"Exclude notes"` (visible + `aria-label`) | ⚠️ **label drift** |
| Min/Max px | `"Minimum node size (px)"` / `"Maximum node size (px)"` | `"Min px"` / `"Max px"` | ⚠️ **label drift** |
| Depth decay k | `"Depth decay k"` | `"Depth decay k"` | ✅ |
| Sizing metric toggle a11y | `"<label> enabled"` | *implicit* from wrapping `<label>`, no `aria-label` | ⚠️ convention drift |
| Sizing number a11y | `aria-label` = full row name | **none** (implicit) | ⚠️ **a11y drift** (ticket item 1) |
| Force layout labels/descs | `FORCE_LAYOUT_FIELD_META` visible desc | same table, desc as `title` | ✅ shared data, different presentation (justified: 260px panel) |
| Force restore button a11y | `aria-label` = scope label (`"Restore force layout defaults"`) | text-only + `title` (own un-shared copy) | ⚠️ **a11y drift** (ticket item 2) |
| Preview row | `"Preview"` + visible description | `"Preview"`, description as per-option `title` | ✅ shared data |
| Advanced group | `"Advanced spacing"` (`<details>`) | `"Advanced spacing"` (nested `Disclosure`) | ✅ |
| Radio group `name` | tab-local const `NODE_PREVIEW_RADIO_GROUP` (`:74`) | `useId()` (`NodeContentsSection.tsx:34`) | **must stay divergent** — radio grouping is document-scoped, one shared literal would fuse the two pills |

⚠️ **Do NOT introduce any new `Restore`-prefixed `aria-label` in the settings tab** — `e2e/settingsResetReview.e2e.ts:139-145` asserts an exact ordered list of every `aria-label` starting with `"Restore"` inside `.vicinity-graph-settings`.

---

## 6. `settingsWritePipeline.ts` + `SettingsInteraction`

`src/view/settingsWritePipeline.ts` (135 lines) — 4 rules stated at `:9-28`: serialised on ONE `SerialPromiseChain`; planned from a FRESH read inside the slot; ONE fan-out (`ViewsRefreshPort.refreshAllViews()`); `drain()` makes idle observable.

Public API:
```ts
class SettingsWritePipeline implements SerialSettingsWrites {
  apply(interaction: SettingsInteraction): Promise<void>;              // :68
  restoreDefaults(scope: SettingsResetScope): Promise<void>;           // :77
  runSerialised(task: (writer: SettingsWriter) => Promise<void>): Promise<void>; // :86
  planResetConfirmation(scope): SettingsResetConfirmation | null;      // :95
  drain(): Promise<void>;                                              // :100
}
export interface SettingsWriter { apply(interaction: SettingsInteraction): Promise<void>; } // :43
```
**HAZARD documented at `:36-42`**: code already inside a serialised slot MUST write through the `SettingsWriter` it was handed; calling `pipeline.apply()` from inside a slot deadlocks.

`SettingsInteraction` (10 arms, `settingsWritePlan.ts:35-59`) — the exhaustive list a row descriptor must be able to produce:
`global-depth{direction,value}` · `global-cap{value}` · `global-outline-depth{value}` · `global-node-preview{value}` · `global-sizing-number{field,value}` · `global-sizing-metric-enabled{metric,enabled}` · `global-sizing-metric-weight{metric,weight}` · `global-force-layout-field{field,value}` · `global-exclusion-enabled{enabled}` · `global-exclusion-patterns{patterns}`.

**How each surface emits one today**
- Tab, instant: `void this.writes.apply(interaction)`.
- Tab, typed: `this.debounced.schedule(rowName, (writer) => writer.apply(interaction))`; `.drop(rowName)` when the input is half-typed; `flushOnBlur`.
- Tab, sizing numbers: `SizingRowWrite` (`src/view/sizingRowWrite.ts:37`) — `judge(value) → SizingRowVerdict`, `interactionIfAccepted(value) → SettingsInteraction | null`, `storedValue()`. It deliberately RETURNS an interaction rather than persisting (deadlock avoidance).
- Panel: `useControlsActions().applySettings(interaction)` (via `useOptimisticValue`'s request callback).

Wiring: one pipeline instance in `src/main.ts` (`plugin.settingsWrites`), reached by the tab via a getter and by the panel via `ControlsActions`.

---

## 7. Tests + e2e that pin any of this

### `npm test` (vitest) — 85 files / 1124 tests, all green

| File | What it pins (relevant to this ticket) |
|---|---|
| `src/view/settingsSectionFields.test.ts` (104) | every `ViewSettings`/`DepthSettings`/`NodeExclusionSettings` field appears in **exactly one** section (`:23-33`); `SETTINGS_SECTIONS` === `SECTION_RESET_SCOPES` (`:40-42`); walking every section reset from a tuned ctx restores every field (`:57-104`) |
| `src/view/settingsResetPlan.test.ts` (311) | exact commands per scope; `[...SECTION_RESET_SCOPES,"all"].sort()` === `Object.keys(SETTINGS_RESET_SCOPES).sort()` (`:264`); no bare `"Restore defaults"` label (`:269`); all-label literal (`:273`); all-desc contains `"Pinned notes are kept."` (`:283`), not `"this tab"` (`:287`); **every section label's noun appears in the all-scope description** (`:298-310`) — so renaming a card's reset label forces the all-description to be reworded |
| `src/view/engineDefaultsSingleSource.test.ts` (81) | **source scan**: no view module outside the allowlist (`settingsResetPlan.ts`, `GraphLayoutRunner.ts`, `GraphViewController.ts`) may contain `EngineDefaults.*Settings(`. Matches raw source **including comments** — a doc comment naming the call form trips it. Third test fails if an allowlist entry outlives its call site |
| `src/view/forceLayoutFieldMeta.test.ts` (16) | main ∪ advanced === `Object.keys(FORCE_LAYOUT_RANGES)` (catches a field in BOTH groups) |
| `src/view/sizingMetrics.test.ts` (23) | catches a metric listed TWICE |
| `src/view/nodePreviewPreferenceMeta.test.ts` (25) | 3 option labels distinct, non-colliding with the row label |
| `src/view/settingsWritePlan.test.ts` (151), `settingsWritePipeline.test.ts` (182), `settingsResetSequence.test.ts` (110), `settingsDebounce.test.ts` (184), `optimisticValue.test.ts` (148), `sizingRowWrite.test.ts` (106), `settingsValidation.test.ts` (73), `sizingInput.test.ts`, `clampStepperDepth.test.ts` | the write/merge/order/debounce/optimistic mechanics — unchanged by this ticket |
| `e2e/settingsBaseline.test.ts` (37) | **the independent literal second opinion** on reset copy: the 6 section reset names verbatim (`:24-31`) + `"Restore all Vicinity Graph settings"` (`:35`). Any reset-label rename must edit this file *deliberately* |
| `e2e/selectorGuard.test.ts` (279) | every `.vicinity-graph-*` class an `e2e/*.ts` selector references must appear as a rendered `className`/`cls` literal under `src/view/`. **Fires on any renderer rewrite that renames/removes a class in the same commit as the selector.** Comments are stripped from render sources; `toHaveCount(0)` lines are exempted line-scoped |
| `src/engine/importGuard.test.ts` | zero `obsidian` / `obsidian-id-lib` / `react` / `react-dom` in `src/engine/` **and `src/shared/`** (static, dynamic, side-effect and `require` forms) |
| `e2e/vaultTarget.test.ts` (261) | source-scans every top-level `e2e/*.ts` for destructive writes — that is why `settingsTabPage.ts` and `settingsBaseline.ts` deliberately import no `fs` |

### `npm run test:e2e` (Playwright — release gate, NOT part of `npm test`)

| File | What it pins |
|---|---|
`e2e/settingsBaseline.ts` (143) | the ONE e2e-side model. `SECTION_CARD_HEADINGS` (`:41-50`) is **hand-written** (`Record` over the scope union so a new scope is a compile error), `SETTINGS_TAB_SECTIONS`/`_HEADINGS`/`SECTION_RESET_NAMES`/`ALL_SETTINGS_RESET_*` derived from `settingsResetPlan`, and `CONTROLS_PANEL_DISCLOSURES` (`:132-138`, 5 entries with `startsOpen` + `summaryAlsoMatchesAnAncestor`) hand-written from `GraphToolbar`. **Any card/disclosure add, rename or reorder edits this file.**
`e2e/settingsUxVisual.e2e.ts` (538) | `:65-78` per-disclosure default open state; `:101-125` **top-level panel disclosure count + identity + order** via `.vicinity-graph-toolbar__body > .vicinity-graph-disclosure > .vicinity-graph-disclosure__summary` with `^text\d*$` regexes; `:147-176` **"force layout: 7 sliders"** + 3 named advanced sliders + Repel-force write + Restore-defaults round-trip; `:178-197` tab card count + headings + framed border; `:199-206` reset row count + names; `:222-232` `NAMED_CONTROL_SELECTORS` = `input:not([type=radio]), select, textarea` and **`MIN_NAMED_CONTROLS = 26`** (10 sliders + 9 numbers + 1 textarea + 6 toggles) + `ANY_UNNAMED_CONTROL` must be 0; `:234-264` 8 literal `getByLabel`/`getByRole` names (`Repel force`, `Outline depth`, `Outgoing depth`, `Node cap`, `Exclusion patterns`, `Exclude notes from the graph`, `Own file size enabled`, `Depth decay enabled`) — **and `:239` enables exclusion first so the textarea exists**; `:335-403` Preview-pill on both surfaces; `:476-513` "Outline depth" slider hover readout (the test that guards `setDynamicTooltip()`); `:515-538` panel Preview pill writes the same global
`e2e/settingsResetReview.e2e.ts` (293) | the cross-section isolation matrix (`~:53-136`); `:138-146` **exact ordered list of every `Restore*` `aria-label`** === `EVERY_SETTINGS_RESET_NAME` + all distinct; `:148-155` a section reset re-renders the tab; `~:157-...` "patterns exist but the textarea is hidden" GIVEN (`storeHiddenPatterns`); `:221` focus lands on `"Restore all defaults"`
`e2e/settingsResetVerify.e2e.ts` (170) | `:64` and `:100` `card("Node exclusion").locator("textarea")` **count 0 / value** — the two lines the exclusion ticket names; verbatim pattern list in the confirm dialog; escape/cancel no-ops; long-list scroll
`e2e/settingsDependentRows.e2e.ts` (261) | the two dependent rows: `:196-211` exclusion OFF ⇒ **textarea count 0**; `:213-228` exclusion ON ⇒ textarea re-seeded; `:230-261` sizing metric OFF ⇒ weight **disabled in place, same DOM node**. All three additionally assert focus + scroll + unrelated-row node identity. `UNRELATED_CONTROL_LABEL = "Node cap"` `:38`; `METRIC_UNDER_TEST = SIZING_METRICS[0]` `:47` with a now-unreachable `throw` at `:48-50` (see ticket `nid_...e2esettingsdependentrows...`)
`e2e/settingsTabPage.ts` (97) | page object; `open()` waits for `.vicinity-graph-settings-section` count === `SETTINGS_TAB_SECTIONS.length`; `card(heading)` / `resetButton(heading)` keyed by heading text
`e2e/controlsRestart.e2e.ts` (170), `pinnedCentralScenario.e2e.ts` (174) | panel controls after restart / pins

### 🚩 The three e2e specs the exclusion-patterns ticket says MUST be updated

1. **`e2e/settingsResetVerify.e2e.ts:64` and `:100`** — assert `textarea` count **0** while exclusion is off. Under the new behaviour the textarea always exists → change to `toHaveCount(1)` + `toBeDisabled()`; `:100`'s value check stays valid.
2. **`e2e/settingsUxVisual.e2e.ts`** — `MIN_NAMED_CONTROLS = 26` (`:232`) and the `ANY_UNNAMED_CONTROL` guard (`:224,263`); also the GIVEN at `:239` that enables exclusion so the textarea exists becomes unnecessary (harmless but should be reworded). The textarea, now always present, must still carry `aria-label="Exclusion patterns"` **while disabled**.
3. **`e2e/settingsDependentRows.e2e.ts`** — `:196-228` assert the row appears/disappears across the toggle. Rewrite to the sizing-weight shape already in the same file (`:230-261`): **same DOM node, `toBeDisabled()` / `toBeEnabled()`**, focus + scroll + identity preserved. The optimistic-flip ordering note at `VicinityGraphSettingTab.ts:526-531` applies (flip before the await, click order paints last).

Also worth re-checking: `e2e/settingsResetReview.e2e.ts`'s `storeHiddenPatterns()` helper comment ("the tab hides the textarea in this state") and the same claim inside `SETTINGS_RESET_SCOPES["node-exclusion"].confirmation`'s docblock (`settingsResetPlan.ts:161-167`) — both become false once the row is always rendered. The **confirmation itself must stay** (the patterns are still user-authored content), but the stated rationale needs rewording.

---

## 8. Existing parity-style guards + layering rules the new model must respect

**There is NO tab-vs-panel parity test today.** Closest things:
- `e2e/settingsUxVisual.e2e.ts:101-125` (panel top-level disclosure exhaustiveness) and `:178-197` (tab card headings) — two independent DOM pins, no cross-check.
- `e2e/settingsBaseline.ts` keeps `SETTINGS_TAB_SECTIONS` and `CONTROLS_PANEL_DISCLOSURES` as **two separate hand-written lists**, with a docblock (`:111-131`) explaining that the surfaces genuinely differ (no Performance in the panel; no nested Advanced spacing in the tab).
- `src/view/engineDefaultsSingleSource.test.ts` is the model for a source-scan guard if a runtime parity test needs a stand-in (no React component-test infra exists — ticket `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` is the open `decide` on whether jsdom infra should block this ticket).
- The parity TEST itself is formally ticket 5 (`nid_x6hgehsu5il1d1shuraz3ufqy_e`); this ticket must ship the model it can iterate.

**Layering (enforced)** — `src/engine/importGuard.test.ts`:
- `src/engine/` and `src/shared/` may not import `obsidian`, `obsidian-id-lib`, `react`, `react-dom` (any of: static import/export-from, side-effect import, dynamic `import()`, `require()`).
- ⇒ **A shared row/descriptor model carrying UI copy or grouping must live in `src/view/`, not `src/engine/`** — exactly the reasoning already written into `settingsSectionFields.ts:15-17` ("a 'section' is a settings-tab CARD. The pure engine has no notion of one and must not acquire it") and `forceLayoutFieldMeta.ts:6-9`.
- The model must also stay importable by `e2e/*.ts` (node-side process) — that means **no `obsidian` and no `react` import in the module that holds the row data**, because `e2e/settingsBaseline.ts` already imports `src/view/settingsResetPlan.ts` and pulling `obsidian` into the node test process crashes it (`e2e/settingsBaseline.ts:27-29`). Practically: one pure `src/view/settingsRow*.ts` data module + two presenter modules (`VicinityGraphSettingTab.ts` importing `obsidian`, `*Section.tsx` importing `react`).
- `import from src/engine/index.ts`, never deep engine paths.
- No ESLint in the repo — every structural rule is a vitest source scan.

**Other constraints to honour**
- Obsidian `Setting` API cannot mount inside React ⇒ two renderer implementations, by design (stated in the ticket's CONSTRAINT and at `nodePreviewPreferenceMeta.ts:5-9`, `ForceLayoutSection.tsx:...`, `ToggleSwitch.tsx:4-6`).
- `setDynamicTooltip()` must NOT be removed while `minAppVersion` < 1.13 (`VicinityGraphSettingTab.ts:666-675`; the guard test is `settingsUxVisual.e2e.ts:476-513`).
- `nameToggle` must target the inner `<input>`, not `toggleEl`.
- Radio `name` must stay per-surface (tab constant vs `useId()`).
- CSS: `styles.css` is generated; new authored CSS files must be added to `AUTHORED_CSS_FILES` in `esbuild.config.mjs:47-53` (only `npm run test:e2e` can catch a missing entry — see `settingsUxVisual.e2e.ts:354-365`). Existing settings-tab classes: `.vicinity-graph-settings`, `-section`, `-reset`, `-reset-all`, `-advanced`, `-error`, plus `.vicinity-graph-confirm-items`.
- No `ap_XXX_E` anchors exist in this repo's settings files.
- Follow-up `nid_llfhrqo1ecg8tuxigo7bcrrrf_e` is explicitly scheduled to land **with this ticket**: collapse `SETTINGS_SECTIONS`/`SECTION_RESET_SCOPES` and `SettingsSection`/`SettingsResetScope` (keep `SettingsResetScope` — it adds `"all"`), updating `e2e/settingsBaseline.ts` + `src/view/settingsResetPlan.test.ts` imports in the same change.

---

## 9. VERBATIM current row copy (every settings field) — the strings that become DATA

### Card / group headings
| Surface | Strings, in render order |
|---|---|
| Tab (`setHeading()`) | `Depth (all notes)` · `Node sizing` · `Node contents` · `Force layout` · `Node exclusion` · `Performance` |
| Tab nested | `Advanced spacing` (`<details><summary>`) |
| Panel (`Disclosure summary`) | `Depth (all notes)` (open) · `Node exclusion` · `Node sizing` · `Node contents` · `Force layout` ; nested `Advanced spacing` |
| Panel outer | `Graph controls` |

### Rows
| Field | Tab label | Tab description (verbatim) | Tab a11y name(s) | Panel label | Panel a11y name(s) / tooltip |
|---|---|---|---|---|---|
| `outgoingDepth` | `Outgoing depth` | `How many hops of outgoing links to expand from every central note.` | `Outgoing depth` | `Outgoing` | `Decrease outgoing depth` / `Increase outgoing depth` |
| `incomingDepth` | `Incoming depth` | `How many hops of incoming links (backlinks) to expand from every central note.` | `Incoming depth` | `Incoming` | `Decrease incoming depth` / `Increase incoming depth` |
| (sizing card intro) | — | `Enable metrics and weight their contribution to each node's size. Sizes are normalised across the graph.` | — | — | — |
| `sizing.metrics["own-file-size"]` | `Own file size` | — | `Own file size enabled` / `Own file size weight` | `Own file size` | *(checkbox implicit)* / `Own file size weight`, `title="Weight"` |
| `sizing.metrics["total-linker-size"]` | `Total linker size` | — | `Total linker size enabled` / `Total linker size weight` | `Total linker size` | same idiom |
| `sizing.metrics["backlink-count"]` | `Backlinks` | — | `Backlinks enabled` / `Backlinks weight` | `Backlinks` | same idiom |
| `sizing.metrics["outlink-count"]` | `Outlinks` | — | `Outlinks enabled` / `Outlinks weight` | `Outlinks` | same idiom |
| `sizing.metrics["depth-decay"]` | `Depth decay` | — | `Depth decay enabled` / `Depth decay weight` | `Depth decay` | same idiom |
| `sizing.minPx` | `Minimum node size (px)` | — | `Minimum node size (px)` | `Min px` | **none** |
| `sizing.maxPx` | `Maximum node size (px)` | — | `Maximum node size (px)` | `Max px` | **none** |
| `sizing.depthDecayK` | `Depth decay k` | — | `Depth decay k` | `Depth decay k` | **none** |
| `nodePreviewPreference` | `Preview` (`NODE_PREVIEW_ROW_LABEL`) | `Which preview a node shows when it has both a heading outline and an image. A note that only has one of the two always shows that one.` (`NODE_PREVIEW_ROW_DESCRIPTION`) | radiogroup `aria-label="Preview"`; radios named by visible text | `Preview` | radiogroup `aria-label="Preview"`; per-option `title` = option description |
| ↳ option `auto` | `Auto` | `Let the note decide: the image wins only when it sits before the first heading.` | | `Auto` | as `title` |
| ↳ option `outline` | `Outline` | `Prefer the heading outline. Notes without headings still show their image.` | | `Outline` | as `title` |
| ↳ option `image` | `Image` | `Prefer the first image. Notes without an image still show their outline.` | | `Image` | as `title` |
| `outlineMaxDepth` | `Outline depth` | `How many heading levels a note's outline shows inside its node.` | `Outline depth` | **absent** | — |
| `forceLayout.centerPullStrength` | `Center force` | `Pull of every node toward the graph centre. Keeps loosely-linked notes from drifting away.` | `Center force` | `Center force` | `aria-label="Center force"`, desc as `title` |
| `forceLayout.repelStrength` | `Repel force` | `How strongly nodes and folder groups push each other apart.` | `Repel force` | `Repel force` | idem |
| `forceLayout.linkStrengthFactor` | `Link force` | `Stiffness of the springs that pull linked notes together. 1 is the built-in default.` | `Link force` | `Link force` | idem |
| `forceLayout.linkGapPx` | `Link distance` | `Extra resting distance (px) a link keeps between the two linked boxes.` | `Link distance` | `Link distance` | idem |
| `forceLayout.collidePaddingPx` *(advanced)* | `Node spacing` | `Minimum gap (px) enforced between any two boxes at the top level of the graph.` | `Node spacing` | `Node spacing` | idem |
| `forceLayout.elkNodeSpacingPx` *(advanced)* | `Group member spacing` | `Gap (px) between the notes inside a folder group.` | `Group member spacing` | `Group member spacing` | idem |
| `forceLayout.edgeRoutingClearancePx` *(advanced)* | `Edge clearance` | `Gap (px) a connecting line keeps from the boxes it bends around on its way.` | `Edge clearance` | `Edge clearance` | idem |
| `nodeExclusion.enabled` | `Exclude notes from the graph` | `Hide matching neighbor notes before the graph is built. Central and pinned notes are never excluded.` | `Exclude notes from the graph` | `Exclude notes` | `aria-label="Exclude notes"` |
| `nodeExclusion.patterns` | `Exclusion patterns` | ``One regular expression per line, tested (case-sensitively, unanchored) against each note's vault path including extension. E.g. `^archive/` matches the archive folder at the vault root; `templates/` matches anywhere. Invalid patterns are ignored.`` | `Exclusion patterns` | read-only `<ul aria-label="Exclusion patterns">` | hints: `Patterns are edited in the plugin settings.` / `No patterns yet — add them in the plugin settings.` |
| `nodeCap` | `Node cap` | `Maximum number of non-central nodes rendered. Central and pinned notes are never capped.` | `Node cap` | **absent** | — |

### Reset copy (`SETTINGS_RESET_SCOPES`, `src/view/settingsResetPlan.ts:128-208`) — label doubles as row name, button `aria-label` AND tooltip
| Scope | label | description |
|---|---|---|
| `depth-defaults` | `Restore depth defaults` | `Resets the outgoing and incoming depth used for every central note.` |
| `node-sizing` | `Restore node sizing defaults` | `Resets every sizing metric and weight, the minimum and maximum node size, and the depth decay k.` |
| `node-contents` | `Restore node contents defaults` | `Resets the outline depth to 2 heading levels and the node preview to Auto.` *(interpolated from `SETTINGS_SPEC` + `NODE_PREVIEW_OPTION_META`)* |
| `force-layout` | `Restore force layout defaults` | `Resets every force layout slider, including the ones under Advanced spacing.` |
| `node-exclusion` | `Restore node exclusion defaults` | `Turns exclusion off and deletes every exclusion pattern.` |
| `performance` | `Restore performance defaults` | `Resets the node cap to 100.` *(interpolated)* |
| `all` | `Restore all Vicinity Graph settings` | `Resets every Vicinity Graph setting — depth defaults, node sizing, node contents, force layout, node exclusion and performance — to its shipped default. Pinned notes are kept.` |

Button texts: `Restore defaults` (six cards, `:273`) · `Restore all defaults` (footer, `:317`) · panel `Restore defaults` with `title="Reset all force layout sliders to their shipped defaults."`
Exclusion confirm: title `Restore node exclusion defaults?`, body `Turns exclusion off and deletes the following N exclusion pattern(s). This cannot be undone.`, confirm `Delete patterns and restore defaults`.
All-scope confirm: title `Restore all Vicinity Graph settings?`, body = description + ` This cannot be undone.`, confirm `Restore all defaults`.

---

## 10. Implementation notes / hazards worth stating up front

1. **`engineDefaultsSingleSource.test.ts` matches comments too.** Do not write `EngineDefaults.viewSettings()` (with parens) in any new doc comment under `src/view/` outside the allowlist.
2. **`selectorGuard.test.ts`** means: if the row model changes a rendered class name, the e2e selector must change in the SAME commit — and vice versa.
3. **Reset-label renames cascade three ways**: `e2e/settingsBaseline.test.ts:24-35` literals, `settingsResetPlan.test.ts:298-310` (the noun must appear in the all-description), and `settingsResetReview.e2e.ts:144` (exact ordered `Restore*` aria-label list).
4. **`SECTION_CARD_HEADINGS`** (`e2e/settingsBaseline.ts:41-50`) is the one hand-typed heading list; if the new model exposes headings as data, this ticket can derive it and delete the duplication — that is a real win the ticket should bank.
5. **A `disabledWhen` predicate must read the STORE, not a captured snapshot.** `showExclusionPatterns`'s docblock (`:408-413`) explains why it takes no `enabled` parameter; the same hazard applies to a declarative predicate evaluated inside an async handler. The sizing-metric flip (`:526-531`) documents the safe shape: flip disabled state synchronously in click order, then await the write.
6. **Tab keys its debounce by the row's visible name** — if the row model changes a label, the debounce key changes with it (harmless, but it means labels are load-bearing beyond display).
7. `_assertEveryResetScopePlaced` is already tautological and documented as such — do not "clean it up" without reading `settingsResetPlan.ts:230-248`.
