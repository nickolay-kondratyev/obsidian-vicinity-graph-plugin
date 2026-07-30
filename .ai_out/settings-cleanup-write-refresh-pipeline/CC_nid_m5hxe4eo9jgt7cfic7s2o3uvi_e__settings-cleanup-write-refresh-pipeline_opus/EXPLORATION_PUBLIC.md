# Settings write + refresh pipeline — current-state map (as of this branch)

Scope: ticket `nid_m5hxe4eo9jgt7cfic7s2o3uvi_e` ("one settings write/refresh
pipeline"). Repo: `nickolay-kondratyev_obsidian-vicinity-graph-plugin`.
Per-doc removal (`nid_ez38gf1mrdgh5kxedzrdicwzl_e`) has already landed —
**every setting is global**; there is no per-doc layer, no resolver, no
`ViewSettingsOverride`. This map is verified against code, not older docs.

---

## 1. Every write/persist site — the three hand-rolled serial chains

Three independent "pre-caught tail" serial-promise idioms exist today, all
implementing the same contract (rejection isolation + caller-visible failure)
with slightly different code shapes:

1. **`src/persistence/PluginDataStore.ts:14,66-72`** — field `writeChain`.
   `persist()` does:
   ```
   this.writeChain = this.writeChain.catch(() => undefined).then(() => this.port.saveData(this.data));
   return this.writeChain;
   ```
   Pattern: catch-then-append, store the WHOLE new chain (including the new
   task) back into the field, return that same promise to the caller (so the
   caller does see rejections of its own task, because `.then()` re-throws).
   This is the actual `data.json` writer — `saveGlobalDepths` (L43),
   `saveGlobalView` (L47), `saveNodeExclusion` (L51), `addPin` (L56),
   `removePins` (L61) all funnel through `persist()`.

2. **`src/view/settingsDebounce.ts:44-107`** (`DebouncedSettingsWrites`) —
   field `draining` (L48). Debounce seam for the settings tab's TYPED text/
   number fields; coalesces per-field writes to one per settle window
   (`SETTINGS_WRITE_DEBOUNCE_MS`), drains in edit order. The chain:
   ```
   const drained = this.draining.then(runAll, runAll);   // L103
   this.draining = drained.catch(() => undefined);       // L104
   return drained;                                       // L105
   ```
   Pattern: run `runAll` as success OR failure continuation of the previous
   tail (so a failed drain doesn't block later ones either), store the
   *derived* promise's catch as the new tail, return the un-caught `drained`.

3. **`src/view/settingsWriteQueue.ts:22-37`** (`SettingsWriteQueue`) — field
   `tail` (L24). Serializes the settings tab's whole INTERACTION handlers
   (not just the persist call) so two clicks land in click order, not finish
   order:
   ```
   const running = this.tail.then(write);      // L34
   this.tail = running.catch(() => undefined); // L35
   return running;                             // L36
   ```

All three are functionally the same "SerialPromiseChain" idiom (ticket
`nid_4zffe7mj5p1eabi9m6wfh06k0_e`'s DRY target) but coded three different
ways — the subtlety each one gets right (or must get right) is that the catch
must land on the *stored* tail, never on the promise handed back to the
caller, or the caller stops seeing its own write's rejection. All three
currently get this right, independently.

There is a **fourth, un-serialized write site**: `src/view/ControlsActions.ts`
`applySettings()` (L43-46) — the in-graph controls-panel executor. It calls
`PluginDataStore.saveGlobal*` directly with **no queue of its own** at all.
The only serialization it inherits is `PluginDataStore.writeChain`'s
disk-write ordering; there is no "whole interaction serialized" guarantee
the way the settings tab's `SettingsWriteQueue` provides. See §4.

## 2. Settings-changed refresh fan-out

One port, one rule, reaches **every open view**, unconditionally (this is
correct and simpler than pre-2.5 docs describe — there is no per-doc/sibling
distinction left to make):

- `src/view/viewPorts.ts:57-59` — `ViewsRefreshPort { refreshAllViews(): void }`.
- `src/main.ts:44` wires it: `{ refreshAllViews: () => this.refreshOpenViews() }`.
- `src/main.ts:108-113` `refreshOpenViews()` walks
  `this.app.workspace.getLeavesOfType(VIEW_TYPE_VICINITY_GRAPH)` and calls
  `view.refresh()` on every `VicinityGraphView` leaf — Obsidian-idiomatic
  fan-out, no bespoke event emitter.
- Two call sites reach it:
  - `src/view/VicinityGraphSettingTab.ts:854` (`applyInteraction`) and
    `:871` (`applyReset`) call `this.plugin.refreshOpenViews()` directly
    (plugin reference held by the tab).
  - `src/view/ControlsActions.ts:71-73` (`refreshEveryView`) calls
    `this.viewsRefresh.refreshAllViews()` — reached from `applySettings`
    (L45), `pinNode` (L56), `unpinNode` (L62).
- `GraphViewController` (per-view rebuild pipeline `events → engine →
  structural diff → elkjs → …`) owns latest-wins via a monotonic
  `rebuildToken` (`src/view/GraphViewController.ts:88,182,341`) so a refresh
  racing an in-flight rebuild can't render a stale result.

Architecture-map (`docs-internal/architecture-map.md`, "Key seams" section)
already documents this correctly post-2.5: *"Refresh reach is ONE port:
`ViewsRefreshPort` … rebuilds every open view … there is no narrower reach to
choose — the write-scope classifier and the owning-view port went with the
per-doc layer."* Matches code.

## 3. Settings-tab reset path — the display()-races-a-queued-write bug

`src/view/VicinityGraphSettingTab.ts`:

- `requestReset(scope)` (L285-297) is the one entry point for every reset
  button; it enqueues `applyReset(scope)` through `this.writeQueue`
  (`enqueueWrite`, L843-845) either immediately or behind a confirm modal.
- `applyReset(scope)` (L864-874):
  ```ts
  private async applyReset(scope: SettingsResetScope): Promise<void> {
      await this.settlePendingWrites();                          // L867: drains the debounce window first
      for (const command of planSettingsReset(scope, this.writeContext())) {
          await this.persist(command);                           // L868-870
      }
      this.plugin.refreshOpenViews();                             // L871
      this.display();                                             // L873 — BUG site
  }
  ```
- The bug (`nid_8b97fdqznqsncc5kgya1p871w_e`): `this.display()` at L873 tears
  down and rebuilds every DOM control (`display()` itself is L166-180,
  `containerEl.empty()` then re-renders all six section cards). It runs
  **inside** the same queued task as the reset writes — i.e. the write
  queue's returned promise for this task does not resolve until `display()`
  has already replaced the DOM. If the user clicks another control in the
  same tick (before this queued task settles), that click's handler fires
  synchronously and calls `this.enqueueWrite(...)` (queued correctly, so
  ordering in `data.json` is fine — the store ends up correct), but the click
  was bound to the OLD (pre-reset) DOM node. So the freshly-rebuilt control
  the user now sees shows the post-reset value while a write the user
  actually intended is still landing behind it — a transient store/screen
  disagreement that self-heals only on the next re-display. No data loss;
  purely a redraw-timing issue, already scoped as low-priority/non-blocking.
- `display()` itself documents the constraint at L160-165: callers that
  re-render after a write MUST `await settlePendingWrites()` first because it
  reads globals synchronously — `applyReset` obeys this for the *debounce*
  chain (`settlePendingWrites` at L867) but has no equivalent drain for the
  *write queue* itself before calling `display()`, since `display()` runs
  from inside the very queue task whose completion is what's racing the
  click.
- Options the ticket lists (not yet decided/implemented): have `display()`
  itself drain the write queue; disable tab controls during a reset; or
  accept+document. Explicitly rejected: reintroducing per-control
  re-seeding after every write (that's the focus-stealing repaint pattern
  `nid_9k11zke41l6ze3p7n7suuo4v2_e` removed).

## 4. In-graph controls panel write path — the stale-snapshot clobbering

- `src/view/GraphToolbar.tsx:25-29` builds **one** `SettingsWriteContext`
  per render, from the `ControlsModel` prop:
  ```ts
  const ctx: SettingsWriteContext = {
      globalDepths: controls.globalDepths,
      globalView: controls.globalView,
      nodeExclusion: controls.nodeExclusion,
  };
  ```
  and passes the SAME `ctx` object down to every section:
  `GlobalDepthControls` (L45), `NodeExclusionSection` (L47), `SizingSection`
  (L48), `NodeContentsSection` (L50), `ForceLayoutSection` (L51).
- `ControlsModel` (`src/view/ControlsModel.ts:13-35`) is a **pure snapshot**
  built once per graph rebuild by `ControlsModelBuilder.build()` (L39-47)
  from `GraphRequestInputs` — i.e. it only changes when the whole
  build→layout round-trip completes and `GraphViewController` re-renders.
  There is **no local React state anywhere in these controls** — every field
  (`SizingSection.tsx`, `GlobalDepthControls.tsx`/`DepthStepper.tsx`,
  `ForceLayoutSection.tsx`, `NodeContentsSection.tsx`) is fully controlled
  off this snapshot. That's the root of the "rapid clicks feel laggy" half of
  the ticket (`docs-internal/tickets/ticket-controls-optimistic-input-latency.md`):
  optimistic local state is entirely absent, so a click's visual feedback
  waits for the whole rebuild.
- The clobbering half: `SizingSection.tsx:33-38` builds a whole-object
  `global-sizing` write by spreading `sizing` (`= view.sizing`, itself
  `controls.globalView.sizing`, i.e. the STALE `ctx.globalView` captured at
  render time) — `applySizing` → `planSettingsWrite({ kind: "global-sizing",
  sizing: next }, ctx)` (L34) merges `next` onto `ctx.globalView`, not onto a
  freshly-read store value. If two sizing fields are edited in quick
  succession before the first write's rebuild refreshes `ctx`, the second
  write's `{...sizing, ...}` spread starts from the pre-first-edit object and
  can silently clobber the first edit's field. `GlobalDepthControls.tsx:26-28`
  has the identical shape (`planSettingsWrite({ kind: "global-depth", ...},
  ctx)`), though depth's tiny `MAX_STEPPER_DEPTH = 5` range bounds the
  practical blast radius.
- Contrast with the settings tab: `VicinityGraphSettingTab.writeContext()`
  (`src/view/VicinityGraphSettingTab.ts:876-883`) reads
  `this.store.globalDepths()/globalView()/nodeExclusion()` **fresh from
  `PluginDataStore` on every write** — that's the pattern the ticket's fix
  wants mirrored in the in-view panel (read `pluginDataStore.globalView()` at
  write time instead of `controls.globalView`).
- The executor that finally persists panel writes is
  `src/view/ControlsActions.ts` `applySettings()` (L43-46) →
  `executeSettings()` (L76-88, a switch onto `PluginDataStore.saveGlobal*`) →
  `refreshEveryView()` (L71-73). As noted in §1, this path has **no
  write-queue equivalent** to the settings tab's `SettingsWriteQueue` — only
  `PluginDataStore.writeChain`'s disk-order guarantee, which does not protect
  against the stale-`ctx` merge-base problem (the merge base is computed
  *before* enqueue, from React props, not inside a queued task the way the
  tab's `applyInteraction` computes `planSettingsWrite(interaction,
  this.writeContext())` fresh per queued task).
- `docs-internal/tickets/ticket-controls-optimistic-input-latency.md`
  documents exactly this pair of problems and proposes: (a) optimistic local
  value seeded from the snapshot, reconciled on the next snapshot, for
  steppers/toggles; (b) build the in-view sizing `SettingsInteraction` from a
  freshly-read `pluginDataStore.globalView()` rather than
  `controls.globalView`, mirroring the tab. States the single-field-merge
  rule already lives in `planSettingsWrite` — only the ctx *source* need
  change, not the merge logic.

## 5. The descriptor model (from the just-closed ticket 2, `nid_wimjq4ewgbg21n4zx9d4qq3a0_e`)

Important nuance, ratified by the owner 2026-07-29
(`docs-internal/notes/settings.md`): the literal "one descriptor array driving
defaults/parse/write-plan/reset-scope" was **declined** — deriving the
`ViewSettings` TYPE from a runtime array would weaken compile-time
completeness of the settings types themselves (a standing constraint). What
shipped instead is **"compile-forced N declarations"**: several separately
guarded tables that all key off the same field names, each with a
completeness guard that names the missing/orphan field as a *type error*, not
a runtime check:

- **`src/engine/SettingsSpec.ts`** — `SETTINGS_SPEC` (defaults + bounds).
  `BoundedNumberSpec` / `MinBoundedNumberSpec` / `DefaultSpec<T>` leaf shapes
  (L34-50); `SettingsSpec` mirrors the persisted shape
  (`globalDepths`/`globalView`/`nodeExclusion`, L85-89). Guarded both
  directions: `_assertEverySettingsFieldSpecced` (L114-120,
  `UnspeccedSettingsField`) and `_assertNoOrphanSpecField` (L122-127). This is
  the ROOT everything else derives from — `EngineDefaults.*`, `DEFAULT_*`
  aliases, `FORCE_LAYOUT_RANGES`, view steppers' `MIN_NODE_CAP` etc. all read
  `.default`/`.min`/`.max`/`.step` from here (per its own header comment).
- **Parse** — `src/persistence/persistedShapes.ts` — the `ParsedViewFields`
  mapped type makes an unparsed field a compile error (per settings.md).
- **Write plan** — `src/view/settingsWritePlan.ts` — `SettingsInteraction` /
  `SettingsCommand` unions + `planSettingsWrite()` (L55-79); merges exactly
  one field over a `SettingsWriteContext` (L49-53).
- **Reset scope** — `src/view/settingsSectionFields.ts` (`SECTION_SETTINGS_FIELDS`,
  L46-53, `as const satisfies`) declares which fields each of the 6 UI
  sections owns, guarded by `_assertEverySettingsFieldSectioned`
  (L73-75). `src/view/settingsResetPlan.ts` derives `planSectionReset()`
  (L105-127) from that table, and `SETTINGS_RESET_SCOPES`
  (L128-208, `Readonly<Record<SettingsResetScope, SettingsResetScopeSpec>>`)
  pairs each scope with its label/description/`plan`/optional `confirmation`.
  `planSettingsReset()` (L250-252) and `planSettingsResetConfirmation()`
  (L260-264) are the two pure entry points the tab calls.
- No single "descriptor" module/type exists that a reader can point to as
  *the* descriptor; it's the union of these guarded tables plus the
  `ParsedViewFields` type. Anyone extending this pipeline should keep that
  in mind — "the descriptor model" in this repo means "N compile-forced
  tables", not one row-per-field array.

## 6. `src/shared/` contents + test conventions

Current `src/shared/` (pure, import-guarded by
`src/engine/importGuard.test.ts:1-40`, same rule as `src/engine/`):
`FileKinds.ts`, `MarkdownCodeRegions.ts`, `MarkdownInlineLinks.ts`,
`VaultPathFacts.ts`, `Wikilinks.ts` — each with a colocated `*.test.ts`. All
are synchronous string/path/markdown utilities; **there is no existing
async/Promise helper in `src/shared/` today** — a `SerialPromiseChain` would
be the first of its kind there, per ticket `nid_4zffe7mj5p1eabi9m6wfh06k0_e`'s
proposal.

Test conventions confirmed in the touched files (BDD, `WHEN … THEN …`, one
behavior per test):
- `src/persistence/PluginDataStore.test.ts` — exists (store-level tests).
- `src/view/settingsDebounce.test.ts` — debounce ordering/failure tests.
- `src/view/settingsWriteQueue.test.ts:51-85` — `describe("SettingsWriteQueue
  ordering", …)` / `describe("SettingsWriteQueue failures", …)`, e.g. `it("WHEN
  a second write is enqueued while the first is still in flight THEN the
  first has not been overtaken" …)`, `it("WHEN a write rejects THEN the
  failure reaches ITS caller")`, `it("WHEN a write rejects THEN a later write
  still runs")` — this is the exact ordering+rejection-isolation+
  caller-surfacing test shape the DRY ticket asks the new shared helper to
  reuse.
- `src/view/settingsWritePlan.test.ts`, `src/view/settingsResetPlan.test.ts`,
  `src/view/settingsSectionFields.test.ts` — pure-function tests over the
  descriptor tables.
- `src/view/ControlsActions.test.ts`, `src/view/ControlsModel.test.ts`,
  `src/view/sizingRowWrite.test.ts` — controls-panel write-path tests
  (Obsidian is types-only so these use `Fake*` ports).
- **No vitest harness for `VicinityGraphSettingTab.ts` itself** (per the
  reset-races-write ticket: "the tab has no vitest harness (node env, no
  jsdom, `obsidian` is types-only)"). Verification there is either an
  extracted pure module or Playwright e2e:
  `e2e/settingsResetVerify.e2e.ts`, `e2e/settingsResetReview.e2e.ts`,
  `e2e/settingsBaseline.test.ts` / `e2e/settingsBaseline.ts`,
  `e2e/settingsDependentRows.e2e.ts`, `e2e/settingsUxVisual.e2e.ts`,
  `e2e/settingsTabPage.ts` (page-object helper).

## 7. Docs that describe (or would need to describe) the write path

- **`docs-internal/architecture-map.md`** — "Key seams" section already
  states the post-2.5 refresh model correctly (single `ViewsRefreshPort`,
  no per-doc reach) and the persistence bullet says `data.json` is the only
  store, no per-doc dir. **No update needed for this ticket's scope** unless
  the new `SerialPromiseChain` helper's existence in `src/shared/` should be
  called out as a seam (optional, small addition once it lands).
- **`docs-internal/plan/high-level-plan.md`** — "Pinning and settings" (L66-71)
  and "Persistence" (L73-77) sections already describe global-only settings
  and the deleted per-doc store, with the WHY-NOT rationale. Does not
  describe the write-queue/debounce/serial-chain internals at all (that's
  implementation detail below the plan's altitude) — likely no change
  needed here either, beyond maybe noting the reset-drains-queue behavior
  once fixed, if the plan is meant to state UX guarantees.
- **`README.md`** — "Settings model" (L69-76) already states "every setting
  is global … changing either writes the one global value and refreshes
  every open graph" — consistent with current code. No write-pipeline
  internals are documented here (correctly — README is user-facing).
- **`docs-internal/notes/settings.md`** — the living overarching-context doc
  for the whole `settings-cleanup` tag chain; this is the doc to update as
  ticket 3 (`nid_m5hxe4eo9jgt7cfic7s2o3uvi_e`) and its merged satellites
  close, not the architecture-map/plan/README (those are already correct
  post-2.5).

## Summary of concrete defect locations for the write/refresh pipeline ticket

| # | Defect | File:line |
|---|--------|-----------|
| 1 | 3 duplicated serial-chain idioms | `src/persistence/PluginDataStore.ts:66-72`, `src/view/settingsDebounce.ts:91-106`, `src/view/settingsWriteQueue.ts:31-37` |
| 2 | 4th write site with NO queue at all | `src/view/ControlsActions.ts:43-46,76-88` |
| 3 | reset `display()` races a queued write | `src/view/VicinityGraphSettingTab.ts:864-874` (esp. L873) |
| 4 | panel writes merge onto a stale snapshot `ctx`, not a fresh store read | `src/view/GraphToolbar.tsx:25-29`, `src/view/SizingSection.tsx:33-38`, `src/view/GlobalDepthControls.tsx:26-28` vs. the fresh-read pattern at `src/view/VicinityGraphSettingTab.ts:876-883` |
| 5 | panel controls have no local/optimistic state, fully controlled off `ControlsModel` snapshot | `src/view/ControlsModel.ts:13-47`, `src/view/DepthStepper.tsx`, `src/view/SizingSection.tsx` |
