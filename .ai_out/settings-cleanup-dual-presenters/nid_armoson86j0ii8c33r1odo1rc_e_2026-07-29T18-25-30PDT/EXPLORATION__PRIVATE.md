# EXPLORATION — private working notes (dual presenters, `nid_armoson86j0ii8c33r1odo1rc_e`)

## Method / order of reads
1. `CLAUDE.md`, `_tickets/settings-cleanup-dual-presenters.md`, `docs-internal/notes/settings.md`, `docs-internal/architecture-map.md`.
2. Four linked satellite tickets (mirror outline depth, Depth group, panel a11y nits, exclusion hide-vs-disable).
3. Kicked `npm test` + `npm run check` in background → `.tmp/explore_npm_test.log`, `.tmp/explore_npm_check.log`. **Both exit 0.** 85 files / 1124 tests. Duration ~1.2s (vitest 4.1.10).
4. Source: `SettingsSpec.ts`, `settingsSectionFields.ts`(+test), `nodePreviewPreferenceMeta.ts`, `VicinityGraphSettingTab.ts` (full 792 lines), `settingsWritePlan.ts`, `settingsWritePipeline.ts`, `settingsResetPlan.ts`, `forceLayoutFieldMeta.ts`, `sizingMetrics.ts`, `ControlsModel.ts`, `ControlsActions.ts`, `viewPorts.ts` (port section), `Disclosure.tsx`, `ToggleSwitch.tsx`, `GraphToolbar.tsx`, `GlobalDepthControls.tsx`, `DepthStepper.tsx`, `SizingSection.tsx`, `ForceLayoutSection.tsx`, `NodeContentsSection.tsx`, `NodeExclusionSection.tsx`, `VicinityGraphFlow.tsx`.
5. Tests: `settingsSectionFields.test.ts`, `engineDefaultsSingleSource.test.ts` (head), `settingsResetPlan.test.ts` (grepped assertions), `importGuard.test.ts` (head), `selectorGuard.test.ts` (head).
6. e2e: `settingsBaseline.ts`, `settingsBaseline.test.ts`, `settingsUxVisual.e2e.ts` (full), `settingsResetVerify.e2e.ts` (full), `settingsDependentRows.e2e.ts` (full), `settingsResetReview.e2e.ts` (grepped), `settingsTabPage.ts`.
7. Prior sibling outputs: descriptor-model `IMPLEMENTATION__PUBLIC.md` + `EXPLORATION_PUBLIC__3_ui_tests.md`; listing of write-pipeline outputs.

## Key corrections vs the prior sibling exploration (do not trust the old tables)
- `CentralDepthControls.tsx` **does not exist**. `src/view/GlobalDepthControls.tsx` (35 lines) replaced it. No per-central depth dials, no "Reset to global default" affordance, no pinned/inherited indicator anywhere.
- Panel disclosure count is **5, all unconditional**. The "Pinned centrals (n)" conditional disclosure is gone; `e2e/settingsBaseline.ts:124-131` and `settingsUxVisual.e2e.ts:91-99` now say so explicitly and the regex exemption was removed.
- Depth card heading is **`Depth (all notes)`** on BOTH surfaces (was `Depth defaults`). Owner decision 2026-07-29; the copy comment lives at `VicinityGraphSettingTab.ts:458-461` and `GraphToolbar.tsx:34-40`.
- Depth row descriptions changed to `…from every central note.` (were `…by default.`).
- `depth-defaults` reset description is now `Resets the outgoing and incoming depth used for every central note.` (dropped `Per-note depth overrides are kept.`).
- All-scope description ends `Pinned notes are kept.` (was `Per-note depth overrides and pinned notes are kept.`).
- `settingsWriteScope.ts` **no longer exists** (went with the per-doc layer). `ViewsRefreshPort` is the only refresh reach.
- `ForceLayoutSection`'s restore button already routes through `actions.restoreDefaults("force-layout")` → `planSettingsReset` (fixed in ticket 2). The old "fourth opinion on defaults" is closed; `engineDefaultsSingleSource.test.ts` keeps it closed.
- File is 792 lines, not 903 — every line ref in the old table is shifted.
- `MIN_NAMED_CONTROLS` is **26** (comment says 10 sliders + 9 number inputs + 1 textarea + 6 toggles). Sliders: 2 depth + 1 outline + 7 force = 10 ✓. Numbers: 5 metric weights + 3 sizing + node cap = 9 ✓. Toggles: 5 metrics + exclusion = 6 ✓.

## Counting checks I did by hand
- Tab rows with a control: 2 depth + (5 metric rows × 2 controls) + 3 sizing numbers + 1 preview pill (3 radios) + 1 outline slider + 7 force sliders + 1 exclusion toggle + 1 exclusion textarea + 1 node cap = 26 named controls + 3 radios (exempt) + 7 reset buttons.
- Tab cards: 6 `.vicinity-graph-settings-section` + 1 `.vicinity-graph-settings-reset-all` footer div.
- Panel controls: 4 depth buttons + 5 checkboxes + 5 weight numbers + 3 sizing numbers + 3 radios + 7 range sliders + 1 exclusion checkbox + 1 restore button = 29 interactive elements.

## Exact a11y holes found (matching the a11y-nits ticket)
- `SizingSection.tsx` `SizingNumber` (now `:100-134`, the ticket cites `:116-126`) — `<input type=number>` inside `<label>` with sibling `<span>{label}`: implicit name only, no `aria-label`. Its "twin" cited at `:53-67` is `SizingMetricRow`'s toggle, which ALSO has no `aria-label` (only the weight input beside it does, `:76`). So the inconsistency is: **weight inputs are explicitly named, min/max/k inputs and metric checkboxes are not.**
- `ForceLayoutSection.tsx:55-62` restore button — text + `title`, no `aria-label`. Its tab twin's accessible name carries the SCOPE (`Restore force layout defaults`). Ticket warns: do NOT add a new `Restore`-prefixed aria-label **in the settings tab** (the e2e exact-list). Adding one in the PANEL is fine — `settingsResetReview.e2e.ts:141` scopes its locator to `.vicinity-graph-settings`.

## Open judgement calls for the planner
- **Where does the row model live?** Candidate: extend `src/view/settingsSectionFields.ts` with a per-family copy/row column (ticket-2's explicit directive), or a new sibling `src/view/settingsRowModel.ts` importing it. Must remain `obsidian`-free and `react`-free so `e2e/*.ts` can import it (node-side process crashes on `obsidian`).
- **How are composite fields (`sizing`, `forceLayout`) represented?** `SECTION_SETTINGS_FIELDS` lists them as ONE `keyof ViewSettings` each, but they expand to 13 + 7 rows. The row model needs a level below the field key (metric id / force field key) — probably a row list per section whose entries reference `{field, subKey?}` and carry their own interaction factory.
- **Does the row model own the interaction factory?** That would let a parity test assert "every row produces a valid `SettingsInteraction`" and would remove the last per-row hand-written write. Risk: the debounce/`SizingRowWrite` verdict path is not a pure `value → interaction` function (it rejects). Suggest: `toInteraction(value): SettingsInteraction | null`.
- **Panel-only vs tab-only rows must be DECLARED, not implied.** The delta (nodeCap tab-only; patterns editable tab-only, read-only in panel) has to be a field on the row descriptor (e.g. `surfaces: "both" | "tab" | "panel"` or `panel: "control" | "readonly" | "none"`) or the parity test becomes an allowlist again.
- **`disabledWhen`** shape: needs the CURRENT globals, not a snapshot. Suggest `disabledWhen?: (ctx: SettingsWriteContext) => boolean` — the pipeline's own context type, already available on both surfaces (tab: `this.store.*()`; panel: `ControlsModel`).
- **React component-test infra** (`nid_7qot0m6nuxxmd5z0yb9jylsd6_e`) is an open `decide` that may block: no test in `npm test` renders a component, so a "panel renders every declared row" claim can only be a source scan or an e2e assertion today.

## Things I verified by grep (negative results)
- `grep -rn "ap_[a-z0-9_]*_[Ee]" src e2e` → nothing settings-related; no anchors to preserve.
- `addDropdown` / `<select>` → never used in the tab; the e2e named-control selector includes `select` defensively only.
- `grep -rn "Pinned centrals" src/` → 0 hits.
- `grep -rn "setDisabled" src/view/VicinityGraphSettingTab.ts` → `:531` (weightInput on toggle) and `:545` (initial seed). Only those two.
