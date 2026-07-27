# EXPLORATION — settings-debounce-validation (code map)

Branch: `settings-debounce-validation`. Ticket: debounce numeric/text writes in the settings tab
and validate min/max bounds (esp. `maxPx < minPx`) + surface invalid-regex feedback.

Prior background doc (already exists, read for context, do not redo its "already done" list):
`.ai_out/settings-ux-improvements/settings/EXPLORATION_PUBLIC.md` — full settings inventory table,
rough-edges list, and the exact open ticket this work should close (see §7 below). This document
adds the code-line detail needed to actually implement.

## 1. `src/view/VicinityGraphSettingTab.ts` (635 lines) — every number/text/textarea field

`display()` (line 120) calls, in order: `renderDepthDefaults()` (280, sliders only — not in scope),
`renderSizing()` (301), `renderNodeContents()` (371, outline depth is a slider — not in scope),
`renderForceLayout()` (214, sliders only — not in scope), `renderExclusion()` (238),
`renderPerformance()` (433), `renderRestoreAll()` (188).

Fields in scope (number/text/textarea — sliders are NOT number/text inputs and already have
`setDynamicTooltip()` + hard `setLimits(min,max,step)`, so they are implicitly clamp-safe; the
ticket's "number/text field" wording matches the `addText()`/`addTextArea()` controls below):

1. **Exclusion patterns textarea** — `addExclusionPatterns()`, line 261-278. `text.onChange((raw) => …)`
   at line 271 calls `parseExclusionPatterns(raw)` (line 87-92: split by `\n`, trim, drop blanks —
   does NOT validate regex compilability) then `void this.applyInteraction({ kind:
   "global-node-exclusion", nodeExclusion: {...} })` — writes + rebuilds on every keystroke. No
   min/max concept applies (it's a list of strings). No error surface at all.
2. **Per-metric weight** (`renderSizing()`, line 324-342) — `addText()`, `type="number"`,
   `VicinityGraphSettingTab.applyRange(text.inputEl, SIZING_RANGES.metricWeight)` (line 326,
   mirrors min/max/step onto native `<input>` attrs but does NOT block a typed out-of-range value).
   `onChange` (332-341): `parseSizingInput(raw)` → if defined, `void this.applySizing(...)` →
   `applyInteraction({kind:"global-sizing", sizing})`. Clamped downstream by
   `clampSizingSettings` (see §3) inside `planSettingsWrite`'s `"global-sizing"` case — so weight
   IS clamped end-to-end, just not validated/error-surfaced client-side, and fires every keystroke.
3. **Minimum node size (px)** — `addSizingNumber(section, "Minimum node size (px)", sizing.minPx,
   SIZING_RANGES.minPx, ...)` at line 345, builder at 522-541. Same `applyRange` + `parseSizingInput`
   + `applySizing` pattern. `SIZING_RANGES.minPx` = `{min:1, max:400, step:4}` (from
   `NODE_SIZE_PX_BOUNDS` in `SettingsSpec.ts:115`) — **a max already exists** (400), contrary to
   the ticket text's "only a lower bound"; what's actually missing is CROSS-validation
   (`maxPx >= minPx`), not an upper bound per se. Confirm this before implementing — the ticket
   description may be stale relative to `SettingsSpec.ts`'s current NODE_SIZE_PX_BOUNDS.
4. **Maximum node size (px)** — line 348, same builder, `SIZING_RANGES.maxPx` = same `{1,400,4}`
   bounds (own key in `SETTINGS_SPEC.globalView.sizing.maxPx`, line 186 of `SettingsSpec.ts`).
5. **Depth decay k** — line 351, `SIZING_RANGES.depthDecayK` = `{min:0, max:10, step:0.5}`
   (`SettingsSpec.ts:184`) — this one genuinely has both bounds too. So of the three "sizing
   number" fields, ALL have `{min,max,step}` in the spec already; only min/max CROSS-CHECK
   (maxPx ≥ minPx) is actually absent anywhere in the pipeline (confirmed — see §3).
6. **Node cap** — `renderPerformance()`, line 433-454. Hand-rolled (NOT via `addSizingNumber`):
   `text.inputEl.min = String(MIN_NODE_CAP)` (442, lower bound only, no `.max`/`.step` mirrored
   beyond `step`), `onChange` (446-451): `const value = Number(raw); if (Number.isInteger(value)
   && value >= MIN_NODE_CAP) { void this.applyInteraction({kind:"global-cap", value}); }` — NO
   upper bound anywhere (`ViewSpec.nodeCap` is `MinBoundedNumberSpec`, `SettingsSpec.ts:71`, — only
   `{default,min}`, deliberately unbounded above per the type). If the ticket wants an upper bound
   added here, it requires widening `MinBoundedNumberSpec`→`BoundedNumberSpec` for `nodeCap` in the
   spec, not just a view-side clamp — a spec-shape change.

All six routes converge on `private async applyInteraction(interaction): Promise<void>` (line
584-587): `await this.persist(planSettingsWrite(interaction, this.writeContext()));
this.plugin.refreshOpenViews();` — i.e. persist (async plugin data write) THEN
`refreshOpenViews()` which iterates every open `VicinityGraphView` leaf and calls `view.refresh()`
→ `GraphViewController.handleSettingsChanged()` (immediate rebuild, no debounce - see §6). This is
the ONE seam to add debouncing at: wrapping/guarding `applyInteraction` (or the `onChange`
callsites) with a per-field timer, WITHOUT breaking `writeContext()`'s "read globals fresh on every
edit" invariant (comment at line 605-611) that lets rapid edits to sibling fields compose instead
of clobbering (this is the exact concern the existing
`ticket-controls-optimistic-input-latency.md` raises for the in-view mirror — the settings tab
already does the right "read fresh" thing, a debounce must not regress that).

## 2. SETTINGS_SPEC — location + shape

`src/engine/SettingsSpec.ts` (302 lines), pure engine module (imports only `./types`, import-guarded).
Leaf shapes (line 32-48): `BoundedNumberSpec {default,min,max,step}`, `MinBoundedNumberSpec
{default,min}` (used ONLY by `nodeCap`, line 71), `DefaultSpec<T> {default}` (enums/bools/lists).
Section shapes mirror persisted `PluginData` nesting: `DepthSpec`, `SizingSpec` (line 59-66:
`metrics`, `metricWeight`, `depthDecayK`, `minPx`, `maxPx` — all `BoundedNumberSpec` except
`metrics` itself), `ForceLayoutSpec`, `ViewSpec`, `NodeExclusionSpec`. The whole tree is
`SETTINGS_SPEC: SettingsSpec` (line 121-302).

- `minPx`/`maxPx` share `NODE_SIZE_PX_BOUNDS = {min:1, max:400, step:4}` (line 115) — defined as ONE
  constant, spread into both (`minPx: {default:40, ...NODE_SIZE_PX_BOUNDS}` line 185, `maxPx:
  {default:160, ...NODE_SIZE_PX_BOUNDS}` line 186). **No cross-field concept exists in the spec
  shape at all** — `SizingSpec` has no `min(maxPx) >= minPx` invariant, and nothing anywhere
  (spec, `clampSizingSettings`, `NodeSizer`) currently enforces `maxPx >= minPx`. This is the
  concrete gap the ticket names.
- `depthDecayK`: `{default:1, min:0, max:10, step:0.5}` (line 184) — already fully bounded both ends.
- Upper-bound concept DOES exist generically (`BoundedNumberSpec.max`) — it's used everywhere
  except `nodeCap`. So "no upper bound" in the ticket is accurate only for `nodeCap`; for
  minPx/maxPx/depthDecayK the real gap is the missing CROSS-validation, not a missing max.
- Consumers: `src/engine/SettingsDefaults.ts` and `src/engine/constants.ts` project
  `DEFAULT_*`/`FORCE_LAYOUT_RANGES`/`SIZING_RANGES`/`MIN_NODE_CAP`/`MIN_STEPPER_DEPTH` etc. straight
  from `SETTINGS_SPEC` (thin re-exports, no duplicated literals — see `constants.ts:17-57`).
- Restore-defaults: `src/view/settingsResetPlan.ts` (`planSettingsReset`) builds
  `SettingsCommand`s from `SETTINGS_SPEC`'s `.default`s per scope (`SETTINGS_RESET_SCOPES`);
  `VicinityGraphSettingTab.addSectionReset()` (line 151-166) wires the button per card.
- `src/engine/SettingsSpec.test.ts` locks in every literal default/bound — any spec change
  (e.g. widening `nodeCap` to `BoundedNumberSpec`, or adding a cross-field rule) must update this
  test file too.

## 3. Where clamping/validation currently happens — the seam

Single clamp choke-point for sizing: `src/engine/constants.ts`:
- `SIZING_RANGES` (line 139-144): per-field `{min,max,step}` table for `metricWeight, depthDecayK,
  minPx, maxPx`, projected from `SETTINGS_SPEC.globalView.sizing`.
- `clampSizingSettings(settings: SizingSettings): SizingSettings` (line 157-172) — clamps each
  metric's `weight`, `depthDecayK`, `minPx`, `maxPx` independently via `clampIntoRange()` (line
  109-114, also resolves `NaN`→field default). **Each field is clamped in isolation — there is no
  step where `maxPx` is compared against the (possibly just-clamped) `minPx`.** This is called from
  exactly two places: `src/view/settingsWritePlan.ts`'s `"global-sizing"` case (line ~93, the
  settings-tab + in-view sizing write path — see comment there: "Clamped HERE, the one choke point
  both sizing surfaces… write through") and `src/engine/NodeSizer.ts:45` (`const settings =
  clampSizingSettings(rawSettings)`, defense-in-depth at actual sizing-compute time, also isolated
  per field).
- `clampForceLayoutSettings` (constants.ts:121-134) — same isolated-per-field pattern, but ONLY
  called on the persistence-LOAD path (`src/persistence/persistedShapes.ts`), NOT on every write —
  contrast with sizing's write-time clamp. Confirmed by the spec doc comment at constants.ts:151
  ("Stricter than `clampForceLayoutSettings` (load-only) on purpose").
- `clampOutlineMaxDepth` / `clampStepperDepth` (`constants.ts:47-49`, `src/view/constants.ts`) —
  same single-field clamp pattern for their respective fields.
- **Conclusion: there is exactly ONE seam to extend for a `maxPx >= minPx` cross-check —
  `clampSizingSettings` in `src/engine/constants.ts:157-172`** (pure, engine-side, already the sole
  choke point both UI surfaces and `NodeSizer` route through). Adding the cross-check purely inside
  `clampIntoRange`-per-field is not enough; it needs a second pass comparing the two clamped
  values (order of clamp-then-cross-check matters — decide whether an inverted pair silently swaps,
  clamps maxPx up to minPx, or clamps minPx down to maxPx; no existing precedent decides this,
  requires a human/CLARIFICATION call per this repo's engineering norms).
- No separate "settings normalization on load" module beyond `persistedShapes.ts` — it is the one
  parse+clamp layer for on-disk `data.json`, structurally separate from the live UI-write clamp
  in `clampSizingSettings`/`settingsWritePlan.ts`.

## 4. Exclusion-pattern regex compilation

`src/engine/PathExclusionMatcher.ts` (43 lines), pure engine class:
- `static fromPatterns(patterns: readonly string[]): PathExclusionMatcher` (line 20-27) — loops
  patterns, calls private `compile()`, pushes only successes.
- `private static compile(pattern): RegExp | undefined` (line 37-42) — `try { return new
  RegExp(pattern) } catch { return undefined }` — invalid pattern silently dropped, matcher for
  that pattern excludes nothing, NEVER throws (binding step-02 CLARIFICATION per the file's
  top-of-file doc comment).
- **No error/validity surface exists anywhere between this class and the UI.** The settings tab's
  `addExclusionPatterns()` (line 261-278) only calls `parseExclusionPatterns(raw)` (splits/trims/
  drops-blanks, line 87-92) and persists the raw string list — it never calls `PathExclusionMatcher`
  or attempts a `new RegExp(...)` itself to detect per-line validity. To surface per-line feedback,
  the settings tab needs its OWN validity check (e.g. reusing the same `try { new RegExp(line) }
  catch` test PathExclusionMatcher does, or exporting a `isValidPattern`/`compile` helper from
  `PathExclusionMatcher` for the view to call) — currently nothing in `src/engine/index.ts`
  exports a per-pattern validity check, only the whole-matcher factory.
- Where the matcher is actually invoked at build time: search `PathExclusionMatcher.fromPatterns(`
  usage (not read in this pass — likely in the graph builder / traversal engine) to confirm the
  read side is unaffected by adding a view-side validity check (it should be, since the ticket's
  fix is purely additive UI feedback, not a change to matcher semantics).

## 5. Existing debounce utility

`src/view/constants.ts:26` — `export const REBUILD_DEBOUNCE_MS = 500;` — the ONLY named debounce
constant in the repo, but it is NOT a generic debounce utility function; it's a magic-number used
directly inside `GraphViewController.handleMetadataResolved()` (`src/view/GraphViewController.ts:
170-177`):
```ts
handleMetadataResolved(): void {
	this.clearDebounce();
	this.debounceTimer = window.setTimeout(() => {
		this.debounceTimer = null;
		void this.runRebuild();
	}, REBUILD_DEBOUNCE_MS);
}
```
with a hand-rolled `debounceTimer: number | null` field (line 93) and `clearDebounce()` helper
(line 386-391: `if (this.debounceTimer !== null) { window.clearTimeout(...); this.debounceTimer =
null; }`). **There is no shared/reusable `debounce()` function anywhere in `src/**` or `e2e/**`** —
grep for `debounce` across the repo turns up only this one hand-rolled timer pattern (plus its
tests in `GraphViewController.test.ts` lines 790-867, driven with Vitest fake timers + a `window`
shim since the controller debounces via `window.setTimeout` and the node test env has no `window`
by default). Implementing this ticket will either (a) hand-roll the same
timer/clear-timer pattern locally in `VicinityGraphSettingTab.ts` per field (consistent with
existing precedent, no new shared utility), or (b) extract a small reusable debounce helper —
worth a deliberate choice since (a) is the repo's established idiom and a new shared utility would
be the FIRST of its kind.

Obsidian `Setting` API inline-error patterns already used in this repo: `ConfirmModal.ts:57`
`.setWarning()` on a `ButtonComponent` (renders Obsidian's red/warning button style, NOT a text
warning) — this is the only `setWarning`/warning-styling usage found; there is no existing
"red-bordered input" / "inline error text under a Setting" pattern anywhere in `src/view/*.ts` to
copy. Obsidian's own `Setting`/`TextComponent` API has no built-in per-line validation-message
affordance — this ticket's regex-feedback UI would need a hand-built `.setDesc()` update or a
sibling `createEl` inserted under the `Setting`, styled via `settings-tab.css` (scoped under
`.vicinity-graph-settings`) with a new rule (no existing `.mod-error`/`is-invalid`-equivalent class
in that stylesheet currently — checked, none found).

## 6. Persist + rebuild pipeline

Settings-tab write: `applyInteraction()` (line 584-587, `VicinityGraphSettingTab.ts`) → `await
this.persist(command)` (line 619-634, switches on `SettingsCommand.kind`, calls e.g.
`this.store.saveGlobalView(command.view)` — async `PluginDataStore` write, presumably a full
JSON-file write of the plugin's global data) → `this.plugin.refreshOpenViews()` (`src/main.ts:
109-116`, synchronous loop over `getLeavesOfType(VIEW_TYPE_VICINITY_GRAPH)`, calls `view.refresh()`
on each `VicinityGraphView` — defined in `src/view/VicinityGraphView.tsx`, not read in this pass,
presumably delegates into `GraphViewController.handleSettingsChanged()`).

`GraphViewController.handleSettingsChanged()` (`src/view/GraphViewController.ts:160-163`):
```ts
handleSettingsChanged(): void {
	this.clearDebounce();
	void this.runRebuild();
}
```
— cancels any pending debounced metadata-resolve rebuild, then calls `runRebuild()` IMMEDIATELY
(no debounce of its own; the class comment at line 153-159 explicitly says this is deliberate:
"latest-wins `rebuildToken` absorbs stepper bursts, the executor already awaited the write" — i.e.
today's design assumes the CALLER already coalesces bursts, which the settings tab currently does
NOT do for typed fields).

`runRebuild()` (line 190-235+, `private async`) is genuinely expensive: increments a
`rebuildToken` (stale-check guard for overlapping calls), calls `await this.graphBuilder.build(mainPath)`
(full vault traversal + node/edge construction), then — unless `decideLayout()` says
`"reuse-layout"` — runs `await this.layoutRunner.layout(...)` which is an ELK + d3-force layout
pass explicitly profiled inline (`performance.now()` wrapped, logged as "elk+d3 layout pass" at
debug level) specifically because it is the perf-sensitive step ("Wall-time... the baseline the
routing pass must stay well under", line 217-219 comment). So: YES, async, YES, expensive — a
keystroke-triggered rebuild storm is a real cost, confirming the ticket's premise. Force-layout
field changes always force a full relayout (`GraphStructureDiff.sameForceLayout`, not full-read
here but referenced at line 207).

## 7. Related tickets

- **`_tickets/exclusion-settings-debounce-patterns-textarea-surface-invalid-regex-validation.md`**
  (repo-root `_tickets/`, NOT `docs-internal/tickets/` — different location, uses the `ticket` CLI's
  own store per `id:`/`status:` frontmatter) — `status: open`, id `nid_9uu8wncncsj8l59bq17y4gujy_e`.
  This is the closest prior-art ticket and covers exactly items 1-2 of the current ticket's scope
  (exclusion-textarea debounce + invalid-regex feedback) but NOT the sizing min/max cross-validation
  or the broader "every number/text field" debounce. Acceptance criteria: "Textarea does not
  rebuild on every keystroke (debounced or on-blur); invalid patterns are visibly flagged to the
  user." This ticket should likely be closed/superseded once the current work lands, since it's a
  strict subset.
- `docs-internal/tickets/ticket-controls-optimistic-input-latency.md` — the IN-VIEW (not
  settings-tab) sibling problem: rapid stepper/sizing edits from the in-view panel can read a stale
  `snapshot.controls.globalView` and clobber a just-written sibling field, because (unlike the
  settings tab, which already reads `PluginDataStore` fresh per edit — `writeContext()`, line
  606-612) the in-view mirror builds its `SettingsInteraction` from the one-rebuild-behind React
  snapshot. Relevant constraint for THIS ticket: whatever debounce mechanism is added to the
  settings tab must preserve the "read globals fresh at write time" property so it doesn't
  regress into the same staleness bug that other ticket describes for the sibling surface.
- `.ai_out/settings-ux-improvements/settings/EXPLORATION_PUBLIC.md` §5 (`Explicitly
  rejected/deferred by that round's reviewer`) — notes force-layout slider debounce was
  explicitly called a "watch item, not a change request" by a prior reviewer (parity with
  pre-existing settings-tab behavior) — i.e. sliders were deliberately left un-debounced before;
  this ticket is presumably scoped to number/text/textarea only, not sliders, consistent with the
  ticket text ("Every number/text/textarea field").
- No ticket in `docs-internal/tickets/` mentions "exclusion-debounce" by that exact name — the
  actual match lives in the repo-root `_tickets/` directory (a different ticket store than
  `docs-internal/tickets/`; both exist in this repo, check both when triaging "related tickets" in
  future explorations).

## 8. Summary of concrete gaps to close

1. Debounce (or commit-on-blur) for: exclusion-patterns textarea (line 267-277), per-metric
   weight inputs (324-342), minPx/maxPx/depthDecayK (345-353, via `addSizingNumber` 522-541),
   node cap (440-452). All six currently call `void this.applyInteraction(...)` /
   `void this.applySizing(...)` synchronously inside `onChange`.
2. Cross-validate `maxPx >= minPx` — extend `clampSizingSettings` in `src/engine/constants.ts:
   157-172` (the one existing choke point); currently each field clamps independently and an
   inverted pair persists silently.
3. `nodeCap` has NO upper bound at all (`MinBoundedNumberSpec`, `SettingsSpec.ts:71`) — if in
   scope, requires widening the spec type to `BoundedNumberSpec` and adding a `max`/rationale
   comment (following the file's existing WHY-comment convention), plus updating
   `SettingsSpec.test.ts`'s locked-in literals.
4. Invalid-regex per-line feedback in `addExclusionPatterns()` — needs a NEW validity check (no
   existing exported helper; `PathExclusionMatcher.compile` is private) and a NEW inline-error UI
   convention (nothing to reuse in `settings-tab.css` today beyond the button-level `.setWarning()`
   pattern in `ConfirmModal.ts`).
