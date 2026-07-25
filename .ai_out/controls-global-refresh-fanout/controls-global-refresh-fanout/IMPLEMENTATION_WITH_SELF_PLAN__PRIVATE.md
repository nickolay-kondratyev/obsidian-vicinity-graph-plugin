# PRIVATE memory — controls-global-refresh-fanout (IMPLEMENTATION_WITH_SELF_PLAN)

## State: DONE through REVIEW ITERATION 1. 938/938 tests + check green, committed on `controls-global-refresh-fanout`.

## Iteration 1 (all 3 SHOULD-FIX accepted — details in IMPLEMENTATION_ITERATION__PUBLIC.md)
- `WriteOutcome = "persisted" | "not-persisted"` in `ControlsActions.ts` now gates EVERY rebuild.
  `noticeIfNotPersistable` → `persistOutcome`; `executeSettings` returns it. Rule: nothing landed ⇒ nothing rebuilds.
- Scope comments made honest: per-doc is narrow BY SCOPE, not because views are insulated
  (they are not — every view follows the active file, `VicinityGraphView.tsx:119-124`).
- New ticket `docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md`.
- NICE-TO-HAVE N1–N5 deliberately NOT taken (scope). N3 (deferred-view WHY-NOT in `main.ts`) is the
  only one worth revisiting.
- Test-fixture facts: `FakeDocIdPort.markUnidentifiable(path)` is how you produce a `not-persistable`
  verdict; the fake `VaultPort` must ALSO serve that path or you hit the earlier `file === null` branch.

## Plan (all steps done)
1. [x] Pure `settingsWriteScope` + test (5 tests, one per command kind).
2. [x] `ViewsRefreshPort` + `OwningViewPort` in `viewPorts.ts`; `FakeViewsRefresh`.
3. [x] `ControlsActions` ctor: `(OwningViewPort, PersistenceServices, PluginDataStore, VaultPort, ViewsRefreshPort)`;
       global → `refreshEveryView()`, per-doc → `owningView.handleSettingsChanged()`; pin/unpin → fan out.
4. [x] Wire `main.ts` (`private readonly viewsRefresh: ViewsRefreshPort = { refreshAllViews: () => this.refreshOpenViews() }`)
       → `VicinityGraphView` ctor (5th arg) → `ControlsActions` (view passes `this.app.vault`).
5. [x] `ControlsActions.test.ts` (8 tests) — first test file for the class.
6. [x] architecture-map.md key-seams note.

## Hard-won environment facts (do not re-discover)
- `node_modules/obsidian` has `"main": ""` — TYPES ONLY. Importing it under vitest fails
  UNLESS the test file does `vi.mock("obsidian", () => ({ Notice: class {} }))`. That DOES work
  (verified); no vitest alias/config change is needed. No `src/**/__mocks__` exists.
- `DepthOverride` fields are `outgoingDepth` / `incomingDepth`, NOT `outgoing`/`incoming`
  (Direction is `outgoing`/`incoming`; `DIRECTION_DEPTH_FIELD` maps between them). I burned a
  tsc cycle on this — vitest passed while tsc failed, because the literal was only mis-typed.
- `PluginDataStore` ctor takes `PluginDataPort` ⇒ `new PluginDataStore(new FakePluginDataPort())`
  then `await init()`. `PersistenceServices(docIdPort, pluginDataStore, docDataStore, pathDocIdMap[, clock])`
  assembles from `FakeDocIdPort` + `DocDataStore(new FakeFileStorage(), "doc-data")` + `PathDocIdMap`.
  No casts needed anywhere in the new test.
- `main.js` / `styles.css` are gitignored build artifacts — `npm run build` leaves git clean.
- Verbose output → `.tmp/` (t1/t2/tests/check/build.txt).

## Key design conclusions (justify if challenged)
- Global write does NOT also call `owningView.handleSettingsChanged()`: the fan-out already
  includes the originating view (it is an open leaf). Test pins `rebuildCount === 0`.
- Pin/unpin fan out too: pinned set is `data.json`-global; every view renders pinned centrals.
- `OwningViewPort` / `VaultPort` narrowings are test-enabling DIP, zero production behaviour change.

## If more work is asked
- Ticket closure + change_log entry are TOP_LEVEL_AGENT's job (explicitly not mine).
- No e2e run was performed (`npm run test:e2e` needs a real Obsidian; release gate only).
- Follow-up idea, NOT filed: a `NoticePort` would make `ControlsActions` fully obsidian-free.
  Judged scope creep vs. a one-line `vi.mock`.
