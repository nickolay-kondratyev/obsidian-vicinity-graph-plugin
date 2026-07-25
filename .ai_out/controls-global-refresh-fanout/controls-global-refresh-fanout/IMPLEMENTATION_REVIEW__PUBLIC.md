# IMPLEMENTATION_REVIEW__PUBLIC — controls-panel global write fan-out

Reviewed: `git diff main..HEAD` @ `caa4e34` (branch `controls-global-refresh-fanout`).
Ticket `nid_u36pqr4zljs44jt42lk9ln8ry_e`.

## Independently run gates (not taken on trust)

| gate | result |
|---|---|
| `npm test` | **935 passed / 935, 70 files**, exit 0 (`.tmp/rev-test.log`) |
| `npm run check` (`tsc -noEmit`) | **clean**, exit 0 (`.tmp/rev-check.log`) |
| no `sanity_check.sh` in repo | n/a |

## What changed

`ControlsActions.applySettings` now branches on a new pure classifier
`settingsWriteScope(command)`: `global` → `ViewsRefreshPort.refreshAllViews()`
(implemented in `main.ts` over the pre-existing `refreshOpenViews()` leaf walk,
threaded `registerView` → `VicinityGraphView` ctor → `ControlsActions`);
`per-doc` → `owningView.handleSettingsChanged()` as before. `pinNode`/`unpinNode`
also fan out now. Two ctor deps were narrowed (`GraphViewController` →
`OwningViewPort`, `App` → `VaultPort`). New `FakeViewsRefresh`, 13 new tests.

## Claims I verified end-to-end (all hold)

1. **Runtime path is real.** `ControlsActions` is built in `VicinityGraphView.onOpen`
   (`src/view/VicinityGraphView.tsx:63-70`) after `this.controller = controller`, so
   the controls panel cannot exist before the fan-out target is live.
   `main.ts:40` `viewsRefresh` is a field initializer over `this.refreshOpenViews()`
   → `getLeavesOfType(VIEW_TYPE_VICINITY_GRAPH)` → `view.refresh()` →
   `controller?.handleSettingsChanged()`. Synchronous dispatch, per-controller
   `rebuildToken` gives latest-wins per view; the controllers are independent, so
   no cross-view race is introduced.
2. **The originating view IS covered by the fan-out** (the risky part of the design).
   The panel only renders inside an attached, loaded leaf of this view type, and
   `getLeavesOfType` enumerates root/side/floating (popout) splits. So dropping the
   direct `handleSettingsChanged()` on the global path is safe, not a silent
   regression. (One residual case in NICE-TO-HAVE #3.)
3. **Exhaustiveness guard is real, not aspirational** — I empirically added a 6th
   `SettingsCommand` kind against a copy of the classifier and `tsc --strict
   --noImplicitReturns` failed with `TS2366: Function lacks ending return statement`.
   A new command kind cannot silently inherit a scope.
4. **Partition matches the existing one.** `settingsWriteScope`'s 3-global /
   2-per-doc split is exactly `VicinityGraphSettingTab.persist()`
   (`src/view/VicinityGraphSettingTab.ts:544-561`), and every `global-*`
   interaction in `planSettingsWrite` maps into those 3 global kinds.
5. **Tests are real guards, not assertion-fitting.** Reverting `applySettings` to
   `this.owningView.handleSettingsChanged()` leaves `refreshedViewIds` empty and
   fails `ControlsActions.test.ts:80`; the accumulating list in `FakeViewsRefresh`
   also makes a double fan-out fail. BDD, one behaviour per test. No behaviour-
   capturing test or `ap_XXX_E` anchor was removed (diff is additive in `src/`).
6. **Pin fan-out is correct.** The pinned set lives in `data.json`
   (`PluginDataStore`) and every view renders pinned centrals from it, so all views
   were stale on pin before. It is a scope widening beyond the ticket's literal
   wording — flagged for human ack below, not a defect.

## 🚨 BLOCKING

**None.**

## ⚠️ SHOULD-FIX

### S1 — `settingsWriteScope.ts:9-10` states something that is false in practice; per-doc writes leave sibling views stale too

`src/view/settingsWriteScope.ts:9-10` (and the mirror comment in
`src/view/ControlsActions.ts:21`, `src/view/viewPorts.ts:60-62`) says per-doc
writes "only concern the view that made them". But **every** open view follows the
active file — `VicinityGraphView.registerGraphEvents` (`VicinityGraphView.tsx:113-118`)
wires `active-leaf-change` / `file-open` → `controller.handleActiveFileChanged`
for each view, and there is no per-view MAIN lock in `GraphViewController`. So two
open graph views normally show the **same MAIN**, and a depth stepper write in one
leaves the other showing stale depths — the same class of bug this ticket fixes,
and the *more common* configuration.

Why it matters: the doc comment is the justification for the narrower branch; a
future reader will trust a wrong invariant (POLS). The ticket's acceptance
criterion 2 explicitly asks to keep per-doc narrow, so this is not blocking.

Fix (pick one, human call): (a) correct the comments to say "per-doc writes stay
narrow *by ticket scope*, even though sibling views may display the same MAIN",
**and** file a `docs-internal/tickets/` ticket for the per-doc stale-sibling case;
or (b) fan per-doc writes out too — the classifier already isolates the decision,
so it is a one-line change plus a test flip.

### S2 — `ControlsActions.ts:56-57`: a pin that could NOT be persisted still triggers a full N-view rebuild

```ts
this.noticeIfNotPersistable(await this.persistenceServices.pinDoc(file), NOT_PINNABLE_NOTICE);
this.refreshEveryView();   // runs even when the pin was rejected (no stable id)
```
Nothing changed on disk, yet every open view does a graph build + elk layout and
the user simultaneously sees a "can't be pinned" Notice. Before the change this
wasted one rebuild; now it wastes N.

Fix: make the not-persistable branch short-circuit, e.g. have
`noticeIfNotPersistable` return whether the write landed and
`if (!persisted) return;` before `refreshEveryView()`.

Test gap of the same shape: `ControlsActions.test.ts` covers `file === null`
("THEN nothing is refreshed") but **not** the `not-persistable` outcome, which is
the branch that is currently wrong. Add
`WHEN a pin is rejected as not-persistable THEN nothing is refreshed`.

### S3 — stale doc references in the `ControlsActions` header

`src/view/ControlsActions.ts:14` still says "resolves the target `TFile`"
(now `VaultFilePort`) and `:25` "reads the current MAIN via
`controller.currentMainPath()`" (the field is now `owningView`). Small, but this
header is the file's contract text and the diff is what made it wrong.

## 💡 NICE-TO-HAVE

1. **Naming (POLS), `viewPorts.ts:64-68`** — `OwningViewPort` is satisfied by
   `GraphViewController`, not by `VicinityGraphView`; `handleSettingsChanged()` +
   `currentMainPath()` are controller vocabulary. `OwningViewControllerPort` (or
   just noting in the doc that the implementor is the controller) would read truer.
   The narrowing itself is a genuine DIP improvement, not a test contortion: both
   ports are minimal, both are already-established patterns in this repo
   (`obsidianPorts.ts` structural slices), and no production wiring changed.
2. **`refreshEveryView()` (`ControlsActions.ts:71-73`)** is a private one-liner over
   a single port call; its only content is the (good) WHY comment. Consider moving
   that comment to `ViewsRefreshPort` and calling the port directly — one less hop.
3. **Deferred views** — `main.ts:96-102` skips leaves whose `view` is not
   `instanceof VicinityGraphView`; on Obsidian 1.7+ an unloaded leaf carries a
   deferred placeholder. Benign (a deferred view builds fresh when it loads) and
   pre-existing, but global/pin correctness now leans *entirely* on this walk, so a
   one-line WHY-NOT comment there would pay for itself.
4. **Fan-out amplification on slider drags** — `ForceLayoutSection.tsx:35-37` writes
   on every `onChange`, so a drag now costs N builds+layouts instead of 1. Identical
   to what the settings tab already does, and each controller absorbs bursts
   latest-wins, so it is acceptable; relevant to
   `docs-internal/tickets/ticket-controls-optimistic-input-latency.md`, which this
   change does **not** make harder (fan-out is a dispatch decision, orthogonal to
   where a section reads its displayed value).
5. **`Fake*` convention** — `ViewsRefreshPort` got `src/view/FakeViewsRefresh.ts`;
   `OwningViewPort`'s fake is declared inline in the test. Both have precedent
   (`GraphViewController.test.ts` uses inline fakes); flagging only for consistency.
   Also note `FakeViewsRefresh`'s constructor "open view ids" are fictional — it is a
   call recorder in enumerator clothing. Readable and it does catch double fan-out,
   so leave it, but do not read fidelity into it.

## Documentation Updates Needed

- `docs-internal/architecture-map.md:50-53` — accurate as written; no further change.
- Comment corrections in S1 and S3.
- If S1(a) is chosen: new ticket for per-doc stale-sibling refresh.
- Human ack that `pinNode`/`unpinNode` now fan out (behaviour widening past the
  ticket text) — correct in my read, but it is a deliberate scope call.

## Verdict

**READY** — blocking issues: **0**. Nothing here is manufactured: the fix is
correct end-to-end, the compile-time guard is genuine (verified empirically), the
tests fail without the fix, and no prior behaviour or test was removed. S1–S3 are
follow-ups that should land before or right after merge.
