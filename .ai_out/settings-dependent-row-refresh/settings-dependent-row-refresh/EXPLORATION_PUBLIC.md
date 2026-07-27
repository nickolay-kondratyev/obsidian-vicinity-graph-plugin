# EXPLORATION_PUBLIC — settings-dependent-row-refresh

Ticket `nid_9k11zke41l6ze3p7n7suuo4v2_e`: avoid full `display()` rebuild for dependent rows in
`src/view/VicinityGraphSettingTab.ts`.

> Produced by the Explore role (read-only; findings transcribed here by TOP_LEVEL_AGENT).
> Line numbers are as of branch `settings-dependent-row-refresh` @ `main`.

## 1. Structure of `VicinityGraphSettingTab.ts` (752 lines)

`display()` (126-140) does `containerEl.empty()`, then in order:
`renderDepthDefaults()` (370), `renderSizing()` (391), `renderNodeContents()` (463),
`renderForceLayout()` (285), `renderExclusion()` (309), `renderPerformance()` (525),
`renderRestoreAll()` (259). Each builds into its own `createSection()` div (211-213,
`.vicinity-graph-settings-section` card).

### The three `this.display()` call sites

1. **327 — `renderExclusion()` (309-334).** The "Exclude notes from the graph" toggle's `onChange`
   (313-329). Exists to show/hide the `addExclusionPatterns` textarea row (330-332, rendered only
   `if (exclusion.enabled)`). Comment at 326: "Re-render so the patterns textarea tracks the toggle."
2. **413 — `renderSizing()` (391-447).** Each sizing-metric toggle's `onChange` (404-414; one call
   site reused per metric in the loop over `SIZING_METRICS`). Exists only to update the paired
   weight `<input>`'s disabled state (423, `text.setDisabled(!metric.enabled)`). The toggle and the
   weight share **one** `Setting` row (416-440). Comment at 412.
3. **719 — `applyReset()` (710-720).** After persisting a restore-defaults scope's commands, every
   control must re-seed its displayed value from the store. **Semantically different** — a whole-tab
   value reset, not a dependent-row reveal. Out of scope for this ticket; should stay a full rebuild
   (e2e `settingsTabPage.redisplay()` literally calls `app.setting.activeTab?.display()`).

### Existing precedent to generalize

486-497, doc comment on `addNodePreviewSegmented()` (498-523): *"Deliberately NO `this.display()` on
change: the browser already moves the selection, and re-rendering the tab would throw away the
user's keyboard focus mid-arrow-key."* Reviewed and accepted in the prior settings round — this
ticket extends the same principle to two more rows.

Difference vs. that precedent: these two cases are not "leave the DOM alone" — they need either a
sibling control's `disabled` flip (case 2) or insert/remove of a whole extra `Setting` row (case 1).

## 2. Helpers already in `src/view/`

`settingsDebounce.ts` (`DebouncedSettingsWrites`), `settingsResetPlan.ts` (`planSettingsReset`),
`settingsWritePlan.ts` (`planSettingsWrite`), `settingsValidation.ts`, `sizingRowWrite.ts`
(`SizingRowWrite` — DOM-free, constructor takes getters/setters), `sizingInput.ts`,
`forceLayoutFieldMeta.ts`, `nodePreviewPreferenceMeta.ts`, `sizingMetrics.ts`, `ConfirmModal.ts`.
All pure ones are unit-tested.

**No row-lifecycle abstraction exists.** Row builders (`addLabeledSlider`, `addSizingNumber`,
`addExclusionPatterns`, `addForceLayoutSlider`, 568-682) are private methods that build fresh each
time their `renderX()` runs. That absence of a "rebuild just this row" seam is *why* both toggles
reach for `this.display()`.

## 3. Testing situation — CRITICAL

- `node_modules/obsidian` is **types-only** (`"main": ""`, ships only `.d.ts`). No runtime JS.
- `vitest.config.ts` sets no `environment` → defaults to **node**. No `jsdom`/`happy-dom` in
  devDependencies. **There is no DOM in the unit-test process.**
- Existing pattern for anything importing `obsidian` at runtime: `vi.mock("obsidian", ...)`
  (`src/view/ControlsActions.test.ts:15-18`). `src/engine/importGuard.test.ts` is a static source scan.
- `Setting` takes a real `HTMLElement` and builds child elements — not meaningfully fakeable without
  a real DOM plus a hand-written Obsidian shim.
- Confirmed by prior round (`.ai_out/settings-ux-improvements/settings/EXPLORATION_PUBLIC.md:133-135`):
  no `.test.tsx` for the settings tab class; DOM coverage is **e2e-only**, unit tests cover only the
  pure logic each row delegates to.

**Recommended test approach:** any *new pure logic* extracted by the fix is unit-testable today with
vitest (like `sizingRowWrite.ts`). The acceptance criteria themselves (focus/scroll preserved, only
one row mutated) are e2e-level: `e2e/settingsUxVisual.e2e.ts` + `e2e/settingsTabPage.ts` page object,
asserting `document.activeElement`, `scrollTop`, and DOM-node identity of an unrelated row across the
toggle. `e2e/settingsBaseline.ts` holds shared section/name constants. Note `npm run test:e2e` needs a
real Obsidian and is a release gate, not part of `npm test`.

## 4. Settings model

`src/engine/SettingsSpec.ts` (`SETTINGS_SPEC`, single source of defaults + bounds) →
`SettingsDefaults.ts`, `constants.ts` → re-exported via `src/engine/index.ts`.
`src/persistence/PluginDataStore.ts` provides `globalDepths()/globalView()/nodeExclusion()` and the
`saveX` writers; the tab's only handle is `this.store` (102-104).
`applyReset()` drains pending debounced writes → persists commands → `refreshOpenViews()` → `display()`.

## 5. Constraints & risks for the implementer

1. **Case 2 (sizing) is easy**: toggle and weight input are built in the same loop iteration; keep a
   closure reference to the weight `TextComponent` and call `text.setDisabled(!enabled)` directly.
   Zero rebuild, mirrors the Preview-pill precedent.
2. **Case 1 (exclusion) is harder**: insert/remove of a whole `Setting` (textarea + feedback slot +
   blur/debounce wiring). Two options — (a) always render and toggle a hidden/disabled state, which
   **changes the DOM contract** e2e control-counting relies on; (b) imperatively create/destroy just
   that row's `Setting` from the toggle's `onChange`, holding the section element + created row
   reference. (b) preserves today's contract.
3. Must preserve `e2e/settingsUxVisual.e2e.ts` contracts: card count (`SETTINGS_TAB_SECTIONS.length`,
   6 cards), per-card heading text, `MIN_NAMED_CONTROLS`/`ANY_UNNAMED_CONTROL` accessible-name
   guarantees, `.vicinity-graph-settings-reset`, and `settingsTabPage.redisplay()`.
4. Ordering guarantee: `hide()` (146-149) and `flushOnBlur` (155-159) rely on `settlePendingWrites()`
   running before any re-seed from the store (see comments at 120-125, 318-321, 405-406). A
   row-scoped update must not let a pending debounced write land after the partial update and show a
   stale value.
5. Layering (`docs-internal/architecture-map.md`): this is a **`src/view/`-only** change. Do not touch
   the `refreshOpenViews()` fan-out (`applyInteraction()`, 698-701) — separate concern from `display()`.
6. The `obsidian-settings` skill covers exactly this surface (progressive disclosure); the repo already
   cites it by name. **The implementer should invoke it before touching row-update mechanics.**

## 6. Open question deliberately left to IMPLEMENTATION

Whether to introduce a small dependent-row abstraction (OCP-friendly, reusable as more conditional
rows appear) or two local, minimal fixes. Pareto favors minimal + hyper-obvious; a shared seam is
only worth it if both cases genuinely collapse into it without contortion.
