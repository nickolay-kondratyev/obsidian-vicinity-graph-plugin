# EXPLORATION_PUBLIC.md — settings (current-state map, post settings-ux-improvements + settings-centralization)

Scope note: a prior round (`.ai_out/settings-ux-improvements/settings-ux-improvements/*`, merged via
`094d9e9` "Merge branch 'settings-ux-improvements'") already shipped: boxed settings-tab cards,
fully-collapsible in-graph panel, force-layout parity between the two surfaces, and an
Obsidian-native exclusion toggle. A LATER round (`07c4db7` "centralize defaults + limits into
nested SETTINGS_SPEC", `22bd5cb` "adjust node spacing defaults") then centralized every default
and numeric bound into one file. This document describes the CURRENT state after both rounds —
do not re-propose what's already listed under "Already done" below.

## 1. Files involved

- `src/view/VicinityGraphSettingTab.ts` (361 lines) — the `PluginSettingTab` subclass. `display()`
  (line 58) calls `renderDepthDefaults()` (161), `renderSizing()` (181), `renderForceLayout()` (90),
  `renderExclusion()` (123), `renderPerformance()` (235), in that order. Each `renderX()` builds into
  its own `createSection()` div (`vicinity-graph-settings-section`, line 75-77).
- `src/view/settings-tab.css` (44 lines) — scoped under `.vicinity-graph-settings` (added to
  `containerEl` at line 62 of the tab); frames each section as a bordered/rounded card, styles the
  "Advanced spacing" `<details>` summary. Zero plugin-owned colors (all `var(--*)` theme tokens).
- `src/engine/SettingsSpec.ts` (222 lines) — THE single source of truth for every default and every
  numeric bound (`SETTINGS_SPEC`), shaped to mirror the persisted-data nesting
  (`globalDepths` / `globalView.{nodeCap,groupByFolder,edgeVisibility,sizing,forceLayout}` /
  `nodeExclusion`). `EngineDefaults.*`, `DEFAULT_*` constants, `FORCE_LAYOUT_RANGES`, and the view's
  stepper/cap bound constants all derive from here — no duplicated literals anywhere else.
- `src/engine/SettingsDefaults.ts`, `src/engine/constants.ts` — thin re-export/derivation layer over
  `SETTINGS_SPEC` (e.g. `FORCE_LAYOUT_RANGES`, `MIN_STEPPER_DEPTH`/`MAX_STEPPER_DEPTH`, `MIN_NODE_CAP`).
- `src/view/forceLayoutFieldMeta.ts` (67 lines) — the shared COPY table (label + description) for the
  6 force-layout fields, used by BOTH the settings tab and the in-graph panel so text can't drift;
  also defines `FORCE_LAYOUT_MAIN_FIELDS` (4) / `FORCE_LAYOUT_ADVANCED_FIELDS` (2) with a
  compile-time-exhaustive partition assertion (`_assertEveryForceLayoutFieldGrouped`, line 67).
- `src/view/sizingMetrics.ts` — `SIZING_METRICS` (id+label list for the 5 sizing-metric toggles),
  shared by settings tab and `SizingSection.tsx`.
- `src/view/settingsWritePlan.ts` (101 lines) — pure `SettingsInteraction → SettingsCommand` mapper
  (`planSettingsWrite`), the ONE write contract used by both the settings tab and the in-graph panel.
- **In-graph mirror** (settings tab's twin surface, same interaction kinds): `src/view/GraphToolbar.tsx`
  (panel shell), `src/view/Disclosure.tsx` (shared collapsible primitive), `src/view/ForceLayoutSection.tsx`,
  `src/view/NodeExclusionSection.tsx`, `src/view/SizingSection.tsx`, `src/view/ToggleSwitch.tsx`
  (Obsidian-native-markup switch for React), `src/view/CentralDepthControls.tsx`/`DepthStepper.tsx`.
  CSS: `src/view/graph-view.css` (disclosure/toolbar/exclusion/sizing/forcelayout selectors).
- Persistence/adapters consuming settings: `src/persistence/persistedShapes.ts` (parses + clamps
  every field against the SAME `SETTINGS_SPEC`-derived bounds, e.g. `clampForceLayoutSettings`),
  `src/persistence/PluginDataStore.ts` (`globalDepths()`, `globalView()`, `nodeExclusion()`,
  `saveGlobalDepths/saveGlobalView/saveNodeExclusion`), `src/engine/TraversalSettingsResolver.ts` /
  `src/engine/ViewSettingsResolver.ts` (cascade: doc override → pinned central → global).
- Registration: `src/main.ts:63` — `this.addSettingTab(new VicinityGraphSettingTab(this.app, this))`.
- CSS wiring: `esbuild.config.mjs` now concatenates an ORDERED authored-CSS list (per commit
  `b2fd51a`) so `settings-tab.css` ships inside the plugin's single `styles.css`, which Obsidian
  loads app-wide (reaches the Settings modal DOM, confirmed by e2e).

## 2. Complete settings inventory

| Section (card) | Label | Control | Default | Min / Max / Step | Notes |
|---|---|---|---|---|---|
| Depth defaults | Outgoing depth | slider (dynamic tooltip) | 1 | 0 / 5 / 1 | `MIN_STEPPER_DEPTH`/`MAX_STEPPER_DEPTH`, `DEPTH_STEPPER_BOUNDS` in `SettingsSpec.ts:96` |
| Depth defaults | Incoming depth | slider | 1 | 0 / 5 / 1 | same bounds |
| Node sizing | (desc-only line, no heading control) | — | — | — | `Setting(section).setDesc(...)` only, line 184 |
| Node sizing | `own-file-size` / `total-linker-size` / `backlink-count` / `outlink-count` / `depth-decay` (5 metrics, from `SIZING_METRICS`) | toggle + number (weight) | enabled: only `own-file-size` true, rest false; weight 1 for all | weight min 0, step 0.5 (no max) | weight `addText` disabled when metric off; re-renders whole tab on toggle |
| Node sizing | Minimum node size (px) | number | 40 | min 1, step 4 (no max) | |
| Node sizing | Maximum node size (px) | number | 160 | min 1, step 4 (no max) | no cross-check that max > min |
| Node sizing | Depth decay k | number | 1 | min 0, step 0.5 (no max) | |
| Force layout | Center force | slider | 0.05 | 0 / 0.15 / 0.01 | label/desc from `FORCE_LAYOUT_FIELD_META` |
| Force layout | Repel force | slider | 300 | 50 / 1000 / 10 | |
| Force layout | Link force | slider | 1 | 0.25 / 2 / 0.05 | |
| Force layout | Link distance | slider | 40 | 10 / 250 / 5 | |
| Force layout → Advanced spacing (`<details>`) | Node spacing | slider | 50 | 0 / 100 / 5 | recently bumped max (commit `22bd5cb`) |
| Force layout → Advanced spacing | Group member spacing | slider | 40 | 10 / 120 / 5 | |
| Force layout | Restore force layout defaults | button | — | — | resets to `EngineDefaults.forceLayoutSettings()`, calls `this.display()` |
| Node exclusion | Exclude notes from the graph | toggle | false | — | re-renders tab to show/hide patterns textarea |
| Node exclusion | Exclusion patterns | textarea (4 rows, one regex/line) | `[]` | — | only rendered when enabled=true; writes on every keystroke, no debounce |
| Performance | Node cap | number | 100 | min 1 (no max), step 1 | `MIN_NODE_CAP` |
| — (no settings-tab UI at all) | `groupByFolder` | — | `true` | — | `ViewSettings` field, no interaction kind, no toggle anywhere |
| — (no settings-tab UI at all) | `edgeVisibility` | — | `"walked-from-center"` | — | `ViewSettings` field, no interaction kind, no control anywhere |

In-graph panel (`GraphToolbar.tsx`, all behind the top-level `<details class="vicinity-graph-toolbar">`
"Graph controls" header, itself collapsed by default):
| Disclosure (default state) | Contents |
|---|---|
| Depth (OPEN by default) | `CentralDepthControls` for MAIN — outgoing/incoming steppers (+/- buttons, not a slider) |
| Pinned centrals (N) (collapsed; only rendered if any pinned) | one `CentralDepthControls` per pinned central |
| Node exclusion (collapsed) | `ToggleSwitch` (Obsidian-native markup) + **read-only** pattern list (`<code>` chips) + hint text; count badge shown in the summary row even while collapsed |
| Node sizing (collapsed) | mirrors settings-tab sizing controls exactly (checkbox, not Obsidian toggle, for metric enable) |
| Force layout (collapsed) | full parity: 4 main sliders (native `<input type=range class="slider">`, not Obsidian `Setting`) + nested "Advanced spacing" disclosure (2 sliders) + "Restore defaults" button |

## 3. Existing UX affordances

- **Restore-defaults**: only ONE button exists, "Restore force layout defaults" (settings tab,
  `VicinityGraphSettingTab.ts:101-110`) and its in-graph twin inside `ForceLayoutSection.tsx:53-60`.
  Scope = the whole `ForceLayoutSettings` object only. No restore-defaults for sizing, depth,
  node cap, or exclusion anywhere.
- **Collapsible groups**: settings tab has exactly ONE collapsible, the bare `<details>`/`<summary>`
  "Advanced spacing" inside the Force layout card (no Obsidian styling beyond `settings-tab.css`'s
  muted-summary rule). All 5 settings-tab sections themselves are NOT collapsible — CLARIFICATION
  #2 explicitly chose static boxed cards over collapsibles for the settings tab. The in-graph panel,
  by contrast, is fully collapsible top-to-bottom via the shared `Disclosure` component (`Disclosure.tsx`):
  outer toolbar (`<details>`, closed by default) → Depth (open by default, the only default-open
  section) → Pinned/Exclusion/Sizing/Force-layout (all closed by default).
- **Conditional/progressive disclosure**: exclusion patterns textarea/list only render when
  `enabled === true` (both surfaces); sizing weight input is `disabled` (not hidden) when a metric
  toggle is off; "Advanced spacing" hides the two least-common force sliders behind an extra click
  on both surfaces.
- **Validation**: none beyond basic type/range guards on `onChange` (`Number.isNaN`, `>= min`,
  `Number.isInteger` for node cap). Invalid regex patterns in the exclusion textarea are silently
  accepted into the stored list and silently skipped by the engine matcher at graph-build time —
  no per-line UI feedback (see rough edges + open ticket below).
- **Live-preview/apply**: every control writes immediately on `onChange` (no explicit "Apply"/"Save"
  button anywhere) — sliders fire on every drag tick, number/text fields fire on every keystroke,
  toggles fire immediately. All writes route through `applyInteraction()` →
  `this.plugin.refreshOpenViews()` (settings tab) or `ControlsActionsPort.applySettings()` →
  `GraphViewController.handleSettingsChanged()` (in-graph), both ending in an immediate rebuild;
  a force-layout field change always forces `"relayout"` (`GraphStructureDiff.sameForceLayout`).
  Toggling exclusion-enabled or a sizing-metric re-renders the WHOLE settings tab
  (`this.display()`) to reveal/hide dependent controls — this destroys and rebuilds every `Setting`
  DOM node on every such toggle.

## 4. Tests covering settings

- `src/engine/SettingsSpec.test.ts` — asserts `SETTINGS_SPEC` defaults/limits equal the exact
  shipped baseline (locks in every number in the inventory table above), that `EngineDefaults.*`/
  `DEFAULT_*`/`FORCE_LAYOUT_RANGES`/view bound constants all project from the spec (no drift), and
  that `sizingSettings()` returns fresh (non-aliased) objects on each call.
- `src/view/forceLayoutFieldMeta.test.ts` — main+advanced field groups cover every
  `FORCE_LAYOUT_RANGES` key exactly once (disjointness, complementing the compile-time assertion).
- `src/view/settingsWritePlan.test.ts` — one test per `SettingsInteraction` kind → `SettingsCommand`
  mapping (pin-on-toggle semantics, whole-object merges preserve sibling fields).
- `src/engine/forceLayoutSettings.test.ts`, `src/engine/settingsResolvers.test.ts` — cascade
  (doc → central → global) resolution including `forceLayout`.
- `src/view/GraphStructureDiff.test.ts` — relayout-on-force-change decision logic.
- `src/view/ControlsModel.test.ts` — read-model construction (`excludedNodeCount` etc.).
- `e2e/settingsUxVisual.e2e.ts` (Playwright vs real Obsidian) — 4 tests: panel-defaults disclosure
  states, exclusion toggle round-trip + patterns rendering, force-layout 6-slider live-write +
  restore, settings-tab 5-card CSS reach. Two prior toolbar e2e specs (`controlsRestart.e2e.ts`,
  `pinnedCentralScenario.e2e.ts`) exercise depth/sizing/pin regressions incidentally.
- No `.test.tsx` exists for the settings-tab class itself or for `GraphToolbar`/`ForceLayoutSection`/
  `NodeExclusionSection`/`SizingSection` — coverage of the actual DOM/JSX is e2e-only; unit tests
  cover only the pure logic each component delegates to.

## 5. Prior work already done (do not redo)

From `.ai_out/settings-ux-improvements/settings-ux-improvements/` (CLARIFICATION + REVIEW, merged
`094d9e9`) — **shipped and reviewer-approved (0 blocking)**:
1. Settings-tab visual grouping = **boxed/framed CSS-only cards**, explicitly NOT collapsible
   (human decision, CLARIFICATION #2). Don't re-litigate "should settings tab collapse" — it was
   deliberately rejected in favor of always-visible cards.
2. In-graph panel: ALL sections collapsible via a shared `Disclosure` component; Depth alone open
   by default (CLARIFICATION #3) — everything else (pinned, exclusion, sizing, force layout)
   collapsed by default. This is intentional, not an oversight.
3. In-graph force-layout got FULL settings-tab parity (6 sliders + restore), copy shared via
   `forceLayoutFieldMeta.ts` so the two surfaces can't drift.
4. Node exclusion in-graph = Obsidian-native `ToggleSwitch` (not a checkbox anymore), shows
   **patterns** (read-only) + count when ON — explicitly NOT the excluded-notes list (CLARIFICATION
   #1 scoped this down: "show patterns, not the actual excluded note list"; pattern editing stays
   settings-tab-only, unchanged from an even earlier decision in `global-node-exclusion`).
- Explicitly rejected/deferred by that round's reviewer (`UI_IMPLEMENTATION_REVIEW__PUBLIC.md`):
  - N1: no debounce/throttle on force-layout slider `input` events — reviewer called this a
    "watch item, not a change request" (parity with pre-existing settings-tab behavior).
  - The reviewer's M1 (a misleading e2e locator, not a product bug) was fixed in the very next
    commit (`431e33e`).

Separately, a LATER, unrelated round (`07c4db7`/`22bd5cb`, "settings-centralization" branch) moved
every default/bound into `SettingsSpec.ts` and independently bumped Node-spacing's max from a
smaller value to 100 — pure refactor + one tuning change, no UX/UI change.

Also already resolved/removed (do not propose re-adding): `edgeRouting` toggle (removed entirely,
ticket `02-remove-edge-routing-setting-obstacle-avoidance-always-on.md`, now always-on) and
`layoutMode` dropdown (removed entirely, ticket `layout-mode-optional-per-doc-override...md`,
superseded by force-only layout — the settings tab never needs a layout-mode control).

Open, NOT yet done (existing ticket, still `status: open`):
`_tickets/exclusion-settings-debounce-patterns-textarea-surface-invalid-regex-validation.md` —
(1) debounce the exclusion-patterns textarea (currently rebuilds on every keystroke), (2) surface
per-line invalid-regex feedback (currently silently ignored). This is real remaining work a later
agent could pick up.

## 6. Concrete remaining rough edges (for a later implementation agent)

- `groupByFolder` and `edgeVisibility` are real, persisted `ViewSettings` fields with defaults in
  `SETTINGS_SPEC` (`src/engine/SettingsSpec.ts:69-70`) but have **zero write UI anywhere** —
  no settings-tab control, no in-graph control, no `SettingsInteraction` kind in
  `settingsWritePlan.ts`. They are permanently fixed at their shipped defaults for every user.
  This is the single biggest silent gap in the settings surface (bigger than the exclusion-textarea
  ticket) and isn't tracked by any ticket found.
- `VicinityGraphSettingTab.renderSizing()` (`src/view/VicinityGraphSettingTab.ts:224-232`): Min/Max
  node-size-px and depth-decay-k are three flat `Setting().addText()` number fields with only a
  lower bound and no upper bound and no cross-validation — a user can type `maxPx < minPx` and it
  will silently persist and presumably invert/degenerate sizing with no warning.
- Every settings-tab number/text field commits and rebuilds on every keystroke (no debounce, no
  blur-commit) — `renderExclusion()` (line 152), `renderSizing()` weight/min/max/decay-k
  (lines 211-219, 224-232), `renderPerformance()` node cap (line 246) — all call
  `void this.applyInteraction(...)` directly inside `onChange`. On a large vault a keystroke burst
  triggers a rebuild storm; only the exclusion-textarea half of this is currently ticketed.
- Toggling exclusion-enabled or any sizing-metric-enabled calls `this.display()` (full tab teardown
  + rebuild of every `Setting` in all 5 cards, `VicinityGraphSettingTab.ts:137,201`) just to
  show/hide ONE dependent row — loses whatever scroll position the user had in a long settings tab,
  and is asymptotically wasteful as more conditional rows are added.
- Restore-defaults exists ONLY for force layout. There is no way to reset depth defaults, sizing,
  node cap, or exclusion back to shipped defaults from either surface — a user who over-tunes
  sizing (e.g. sets `maxPx` absurdly high) has no one-click recovery.
- The in-graph "Node exclusion" summary shows a count badge but the sizing/force-layout/pinned
  disclosures never surface any "at a glance" summary of their current state while collapsed
  (e.g. "3/5 metrics on", "tuned" badge) — inconsistent affordance across sibling disclosures.
- `NodeExclusionSection.tsx` renders the pattern list as a plain `<ul>` of `<code>` chips with no
  visual distinguishing of an "empty due to all-invalid-regex" state vs. a genuinely empty pattern
  list — a user with 3 malformed patterns and 0 valid ones sees the exact same "N patterns" list as
  someone with 3 valid ones (ties into the still-open invalid-regex-validation ticket).
- `Node sizing` section header row (`VicinityGraphSettingTab.ts:183-186`) mixes a `.setHeading()`
  `Setting` immediately followed by a description-only `Setting` with no name — two DOM rows for
  what other cards do in one; minor visual inconsistency vs. the other 4 cards which put desc
  directly on `.setHeading()` or on the first real control.
- `settings-tab.css` targets only `.vicinity-graph-settings-advanced > summary` styling; the bare
  `<details>` itself has no card-like framing distinguishing it from a plain browser default (no
  border/background), a visual step down from the boxed-card treatment given to its parent section.
