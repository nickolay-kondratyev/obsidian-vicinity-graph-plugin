# EXPLORATION_PUBLIC — settings write serialization (nid_7ni3rjx3bx6w2bdfvpp7wj0xb_e)

Findings from the EXPLORE phase. Line numbers are as of HEAD `5c3dc40` on branch
`settings-write-serialization`.

## 1. `src/view/VicinityGraphSettingTab.ts` (856 lines)

`class VicinityGraphSettingTab extends PluginSettingTab` (L93).

- L100 `private readonly debounced = new DebouncedSettingsWrites(SETTINGS_WRITE_DEBOUNCE_MS)` — the only
  existing async-coordination state in the tab.
- L102-107 `constructor(app: App, private readonly plugin: VicinityGraphPlugin)`.
- L109-111 `private get store(): PluginDataStore { return this.plugin.pluginDataStore; }`

Write path:

- L802-805 `private async applyInteraction(interaction: SettingsInteraction): Promise<void>` — body is
  `await this.persist(planSettingsWrite(interaction, this.writeContext())); this.plugin.refreshOpenViews();`
  **Correction to the ticket text**: `applyInteraction` does *not* itself await `settlePendingWrites()`;
  that await lives at two call sites (L365, L519).
- L814-824 `private async applyReset(scope)` — `await settlePendingWrites()`, loop `await this.persist(cmd)`
  over `planSettingsReset(...)`, then `refreshOpenViews()` + `this.display()`.
- L827-833 `private writeContext(): SettingsWriteContext` — reads `globalDepths()/globalView()/nodeExclusion()` fresh.
- L840-855 `private async persist(command: SettingsCommand)` — switch: `global-depths` → `store.saveGlobalDepths`,
  `global-view` → `store.saveGlobalView`, `node-exclusion` → `store.saveNodeExclusion`; per-doc kinds return.
  **Natural seam** for interception/queueing.
- L203-209 `private async settlePendingWrites()` — `try { await this.debounced.flush(); } catch { console.error }`.
- L788-790 `applyForceLayout(...)`, L792-794 `applySizing(...)` → both funnel into `applyInteraction`.
- L159-173 `display()`; L179-182 `hide()`; L188-192 `flushOnBlur()`.
- L399-407 `showExclusionPatterns(slot)` — reads `store.nodeExclusion()` fresh, `slot.empty()`, rebuilds only when
  enabled. Deliberately takes no `enabled` param (doc comment L386-397 anticipates out-of-order finishes).

### Call sites of `applyInteraction` (12 total via 8 lexical sites)

| line | control | shape |
|---|---|---|
| 366 | exclusion enable toggle | `await settlePendingWrites()` → `await applyInteraction({kind:"global-node-exclusion", …enabled})` → `showExclusionPatterns(patternsSlot)` (L370) |
| 434 | exclusion patterns textarea | inside `debounced.schedule(name, () => this.applyInteraction(...))` (L433) |
| 581 | Outline depth slider | `void this.applyInteraction({kind:"global-outline-depth"})` |
| 624 | Node preview radio | `void this.applyInteraction({kind:"global-node-preview"})` |
| 646 | Node cap text | `debounced.schedule(nodeCapName, () => this.applyInteraction({kind:"global-cap"}))` |
| 707 | depth sliders (`addDepthSlider`) | `void this.applyInteraction({kind:"global-depth", direction, value})` |
| 521 | sizing metric enable toggle | `weightInput.setDisabled(!enabled)` → `await settlePendingWrites()` → read `store.globalView().sizing` → `await this.applySizing({...})` |
| 544 / 756 / 783 | metric weight (debounced), sizing numbers (`SizingRowWrite.persistIfAccepted`), force-layout sliders | → `applySizing`/`applyForceLayout` → `applyInteraction` |

### Race mechanics (IMPORTANT for the fix)

For the two toggles the snapshot (`writeContext()` / `store.globalView().sizing`) is read **after** an
`await`, so two handlers can both resume off the same pre-write snapshot and the later-*finishing* one wins.
Sliders/radios plan synchronously but still `void` the promise, so `refreshOpenViews()` and later awaited
steps interleave. Debounced thunks are serialized only within `DebouncedSettingsWrites.drain()`.

⇒ A queue that wraps only `persist()` is **insufficient**: the queue must be entered *before* the
snapshot read, so the whole settle → snapshot → persist → refresh sequence is serialized.

## 2. Store & wiring

- `src/persistence/PluginDataStore.ts` — in-memory `data: PluginData` + `private writeChain: Promise<void> = Promise.resolve()` (L14).
  `persist()` (L67-72) sets `this.data = updated` **synchronously**, then
  `this.writeChain = this.writeChain.catch(()=>undefined).then(() => this.port.saveData(this.data)); return this.writeChain;`
  So the store's in-memory value is last-*called*-wins while the returned promise is serialized — the tab's
  reordering happens above this layer.
- Port seam: `PluginDataPort` in `src/persistence/storagePorts.ts`; production impl is the plugin itself
  (`new PluginDataStore(this)`, `src/main.ts:50`). Test fake: `src/persistence/FakePluginDataPort.ts`.
- `src/main.ts`: store created L50-51; tab registered L71; `refreshOpenViews()` L109-116;
  `private readonly viewsRefresh: ViewsRefreshPort` L46 — the tab does **not** use `ViewsRefreshPort`, it calls
  `this.plugin.refreshOpenViews()` directly (L804, L821). Second, currently-unused seam
  (`src/view/viewPorts.ts`, fake at `src/view/FakeViewsRefresh.ts`).

## 3. Existing tests for the tab

**No** unit test constructs `VicinityGraphSettingTab`, and none can today: the tab imports `obsidian`, whose npm
package is types-only (`"main": ""`), and vitest has no alias/mock for it. `sizingRowWrite.ts:11` states outright
"the obsidian tab itself has no test harness".

Instead, pure extracted logic is tested (all `src/view/`): `settingsWritePlan.test.ts`, `settingsResetPlan.test.ts`,
`settingsWriteScope.test.ts`, `settingsValidation.test.ts`, `settingsDebounce.test.ts`, `sizingRowWrite.test.ts`,
`sizingInput.test.ts`, `nodePreviewPreferenceMeta.test.ts`, `forceLayoutFieldMeta.test.ts`, plus
`ControlsActions.test.ts` (constructs `PluginDataStore(new FakePluginDataPort())` + `FakeViewsRefresh` — closest
existing "write + fan-out" pattern).

Real-tab coverage is Playwright/Electron e2e: `e2e/settingsDependentRows.e2e.ts` (the predecessor ticket's spec;
has `flipToggleIn(row)` doing a programmatic `input.click()`), `e2e/settingsUxVisual.e2e.ts`,
`e2e/settingsResetReview.e2e.ts`, `e2e/settingsResetVerify.e2e.ts`, page object `e2e/settingsTabPage.ts`,
harness `e2e/obsidianHarness.ts` (`readGlobals()` L336, `saveGlobal*` L355-392, `refreshOpenViews()` L399).

## 4. Existing async-serialization idiom to be consistent with

Three sites, all the same shape (`tail.catch(() => undefined).then(next)` so one failure cannot wedge the chain,
while the failure still reaches its own caller):

- `src/persistence/PluginDataStore.ts:70-71` (`writeChain`)
- `src/persistence/DocDataStore.ts:99-105` `private enqueue<T>(docid, task)` with `queueByDocid` map
- `src/view/settingsDebounce.ts:47-48, 96-106` `private draining`; `drain()` does
  `const drained = this.draining.then(runAll, runAll); this.draining = drained.catch(() => undefined); return drained;`

A tab-level queue should mirror this exactly.

## 5. Tickets / commits

- This ticket: `_tickets/settings-tab-rapid-double-toggle-can-persist-the-older-value-writes-are-not-serialized.md`
  (nid_7ni3rjx3bx6w2bdfvpp7wj0xb_e, open, bug, p3, tags [settings]). Endorses the single write queue, rejects
  "re-seed each control after its own write", warns a naive double-click test cannot fail (identically shaped
  await chains resolve FIFO) — use a seam on `persist()` or an e2e hook.
- Predecessor `_tickets/settings-tab-avoid-full-display-rebuild-for-dependent-rows.md`
  (nid_9k11zke41l6ze3p7n7suuo4v2_e, **closed** 2026-07-27) — replaced `display()` with `showExclusionPatterns()`,
  which unmasked this race. Artifacts in `.ai_out/settings-dependent-row-refresh/settings-dependent-row-refresh/`.
- Related open: `_tickets/decide-exclusion-patterns-row-hide-it-or-render-it-disabled.md`
  (nid_qp56jugz8en8wkgjirwcb269p_e, referenced at VicinityGraphSettingTab.ts:390),
  `_tickets/a-controls-panel-settings-write-does-not-refresh-other-open-graph-views.md`,
  `docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md`.

## 6. Vitest setup

`vitest.config.ts` sets only `include: ["src/**/*.test.{ts,tsx}", "e2e/**/*.test.ts"]` — **no `environment`**, so
tests run in node; **jsdom/happy-dom are NOT installed**. No setup files, no module aliases, no `obsidian` runtime
mock. Every `src/view/*.test.ts` tests pure TS modules with hand-written fakes (`FakeViewsRefresh`,
`FakePluginDataPort`, `FakeDebounceScheduler` in `settingsDebounce.test.ts:8-30`).
`npm test` = `vitest run`; e2e = `npm run test:e2e` (Playwright picks up `*.e2e.ts` only).

**Implication for the fix's test**: extract the queue into a small pure module (e.g. `settingsWriteQueue.ts`) and
unit-test it in node with an injected gate — matching every existing precedent in this repo. An e2e with an
injected delay on `persist`/`saveData` is the heavier alternative.
