# IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC — controls-panel global write fan-out

Ticket `nid_u36pqr4zljs44jt42lk9ln8ry_e` (bug, p3). Branch `controls-global-refresh-fanout`.

## Seam chosen (as directed: option 1 + 3 from EXPLORATION_PUBLIC)

- `ViewsRefreshPort { refreshAllViews(): void }` in `src/view/viewPorts.ts`,
  implemented in `src/main.ts` as a private field
  `{ refreshAllViews: () => this.refreshOpenViews() }` and threaded
  `registerView` → `VicinityGraphView` ctor → `ControlsActions`. The workspace
  leaf walk stays in `main.ts` (single owner); no duplication, no import cycle.
- `settingsWriteScope(command): "global" | "per-doc"` — pure classifier in
  `src/view/settingsWriteScope.ts`, exhaustive `switch` with every arm
  returning, so `noImplicitReturns` makes a new `SettingsCommand` kind a COMPILE
  error until its scope is declared.
- `FakeViewsRefresh` (`src/view/FakeViewsRefresh.ts`) — constructed with the ids
  of the views a fake workspace has open; `refreshAllViews()` appends all of
  them to `refreshedViewIds`, so tests assert WHICH views were refreshed and a
  double fan-out would show as a duplicated list.

## Two additional narrowings (deliberate, small, enable a mock-light test)

1. `ControlsActions`' first ctor arg is now `OwningViewPort`
   (`currentMainPath()` + `handleSettingsChanged()`) instead of the concrete
   `GraphViewController`. `GraphViewController` satisfies it structurally — no
   production change. Gives the test a 6-line fake instead of a cast.
2. Its `app: App` arg is now `vault: VaultPort` (the existing
   `adapters/obsidianPorts.ts` seam); `App` was only used for `app.vault`. The
   view passes `this.app.vault`. `TFile` satisfies `VaultFilePort`, so
   `PersistenceServices.pinDoc(file)` is unchanged.
   Result: the only remaining `obsidian` runtime import in `ControlsActions` is
   `Notice`, mocked in one line (`vi.mock("obsidian", () => ({ Notice: class {} }))`) —
   necessary because the `obsidian` package has `main: ""` (types only), so the
   module is not importable under vitest without a stand-in.

## Behaviour after the change

| write | refresh |
|---|---|
| `global-depths` / `global-view` / `node-exclusion` | `viewsRefresh.refreshAllViews()` — every open view |
| `doc-depth-field` / `central-depth-field` | `owningView.handleSettingsChanged()` — only the writing view |
| `pinNode` / `unpinNode` | `refreshAllViews()` — pinned set is global `data.json` state |
| ANY write that did not land (no MAIN / not-persistable doc) | **nothing** — added in review iteration 1 |

**No double rebuild.** For a global write the originating view is NOT also
asked to rebuild directly: it is itself an open view, so the plugin's leaf walk
already covers it. Calling both would build twice and flash the canvas. Pinned
by test "…THEN the originating view is not rebuilt a second time on its own".

**pin/unpin INCLUDED** (direction allowed it if clearly correct). The pinned set
lives in `data.json` and every view renders pinned centrals from it — it is
global state by construction (high-level-plan :77), not view-local. Same
one-line application, covered by two tests.

## Files changed
- `src/view/settingsWriteScope.ts` (new) + `settingsWriteScope.test.ts` (new, 5 tests)
- `src/view/FakeViewsRefresh.ts` (new)
- `src/view/ControlsActions.test.ts` (new, 8 tests — first test file for this class)
- `src/view/viewPorts.ts` — `ViewsRefreshPort`, `OwningViewPort`
- `src/view/ControlsActions.ts` — ctor deps + scope branch + `refreshEveryView()`
- `src/view/VicinityGraphView.tsx` — ctor takes `ViewsRefreshPort`, passes `app.vault`
- `src/main.ts` — `viewsRefresh` field, wired into `registerView`
- `docs-internal/architecture-map.md` — key-seams entry for the two refresh ports

## Tests
After review iteration 1: `npm test` **938/938** pass (70 files); `npm run check`
clean. Started from a genuinely failing run in both rounds (round 0: 7 of 13 new
tests failed pre-implementation; iteration 1: all 3 new tests failed first).

## Review iteration 1 (see `IMPLEMENTATION_ITERATION__PUBLIC.md`)
All 3 SHOULD-FIX accepted. `WriteOutcome` now gates every rebuild, the scope
comments state the real (scope-boundary) reason, and
`docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md`
records the newly-understood sibling-view defect.

## Untouched paths (verified)
- `VicinityGraphSettingTab` → `plugin.refreshOpenViews()`: unchanged, and now
  the controls panel takes the exact same route.
- e2e harness callers of `refreshOpenViews()`: unchanged signature/behaviour.
- `VicinityGraphView.refresh()`: unchanged (still the fan-out target).

## Interaction with the optimistic-input-latency ticket
Not made harder: the fan-out is a rebuild-dispatch decision, orthogonal to where
a section reads its displayed value from. When that fix lands (local optimistic
value in the section), the global write still needs the fan-out for the OTHER
views; only the originating view's paint stops depending on the rebuild.

## Rejected alternatives
- Duplicating the workspace loop inside `ControlsActions` (couples it to
  `VicinityGraphView`, import-cycle risk) — rejected per direction.
- New ports for `PersistenceServices` / `PluginDataStore`: unnecessary — both
  already assemble from existing `Fake*` ports in tests.
- Adding a `NoticePort` to drop the last `obsidian` import: real scope creep for
  a one-line `vi.mock`.

## Open questions for a human
None blocking. One judgement call worth a glance: `pinNode`/`unpinNode` now fan
out to all views (was: originating only). This is a small behaviour widening
beyond the ticket's literal wording, argued above.
