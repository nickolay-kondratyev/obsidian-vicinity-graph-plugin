# Settings cleanup — write/refresh pipeline (ticket `nid_m5hxe4eo9jgt7cfic7s2o3uvi_e`)

Status: **implemented**. `npm test` 1113 passed / 85 files. `npm run check` clean
(`tsc` for `src/` + `e2e/`). Working tree left dirty and uncommitted, no tickets
closed, nothing written to `change_log` — per instructions.

---

## The plan I executed

One shared ordering primitive, then ONE pipeline object both settings surfaces
write through, then make the panel's controls optimistic on top of it.

1. `src/shared/SerialPromiseChain.ts` — `run()` + `drain()`; replaces the three
   hand-rolled tails.
2. `src/view/settingsWritePipeline.ts` — `SettingsWritePipeline`: owns the chain,
   the merge base (globals read FRESH inside the serialised slot), the persist
   switch and the `ViewsRefreshPort` fan-out. ONE instance per plugin
   (`src/main.ts:58`), shared by the settings tab and every controls panel.
3. `SettingsInteraction` becomes fully **granular** — one field per arm. The three
   whole-slice arms were the clobbering vector.
4. `src/view/settingsResetSequence.ts` — owns the restore-defaults ORDER, with a
   port so it is unit-testable (the tab has no vitest harness).
5. `src/view/optimisticValue.ts` (pure, tested) + `useOptimisticValue.ts` (thin
   React hook) — panel controls answer input immediately.

---

## How each of the 5 goals is met

### Goal 1 — ONE serial-chain abstraction in `src/shared/`, all sites on it

`src/shared/SerialPromiseChain.ts:25` (`run`), `:44` (`drain`). Pure: no
obsidian/react imports, and it is under `src/shared/`, which
`src/engine/importGuard.test.ts:15-16,62-71` already scans recursively — so the
purity guard covers the new file with no test change (verified: the guard runs
green and is non-vacuous).

The four write sites:

| site | before | after |
|---|---|---|
| `src/persistence/PluginDataStore.ts` | own `writeChain` field | `SerialPromiseChain` (`:73`) |
| `src/view/settingsDebounce.ts` | own `draining` field | **no chain at all** — drains through `pipeline.runSerialised` (`settingsDebounce.ts` `drain()`), so a settling window is ordered against every other settings write, not just against other drains |
| `src/view/settingsWriteQueue.ts` | own `tail` field | **deleted** — the pipeline is the queue |
| `src/view/ControlsActions.ts` (the previously UNQUEUED 4th site) | no queue | every method goes through the pipeline: `applySettings` → `pipeline.apply`, `restoreDefaults` → `pipeline.restoreDefaults`, and `pinNode`/`unpinNode` → `pipeline.runSerialised`, so pin clicks land in click order too |

Re-entrancy (the deadlock the old `SettingsWriteQueue` doc warned about in prose) is
now structural, not documentation: `runSerialised(task)` **hands** the task a
`SettingsWriter` (`settingsWritePipeline.ts:38,79`), so code inside a slot writes
through the object it was given and cannot re-enter the chain.

> Honesty note: implementing this surfaced a latent deadlock I had just
> introduced — the debounced sizing-number thunk still called back into
> `pipeline.apply()` from inside a slot. Fixed by making `SizingRowWrite` *decide*
> instead of persist (`interactionIfAccepted()` returns the interaction or `null`);
> the tab's thunk then writes through the handed-in writer
> (`VicinityGraphSettingTab.ts` `addSizingNumber`). `SizingRowWrite` no longer takes
> a persist callback at all.

### Goal 2 — writes ALWAYS built from freshly read globals

`SettingsWritePipeline.apply()` (`:61-62`) runs `planSettingsWrite(interaction,
this.context())` **inside** `chain.run(...)`, and `context()` (`:98`) reads
`PluginDataStore` at that moment. Same for `restoreDefaults` (`:70`) and for the
reset-confirmation read (`:88`).

The other half of the fix — and the part the exploration map identified as the real
defect — is that **no caller supplies a merge base any more**:

- `SettingsInteraction` is now one-field-per-arm (`settingsWritePlan.ts`): added
  `global-sizing-number`, `global-sizing-metric-enabled`,
  `global-sizing-metric-weight`, `global-force-layout-field`,
  `global-exclusion-enabled`, `global-exclusion-patterns`; **removed**
  `global-sizing`, `global-force-layout`, `global-node-exclusion`.
- `SettingsWriteContext` no longer crosses into React at all: the `ctx` prop is
  gone from `GraphToolbar`, `GlobalDepthControls`, `SizingSection`,
  `NodeContentsSection`, `NodeExclusionSection`, `ForceLayoutSection`.
  `ControlsActionsPort.applySettings` takes an interaction, not a `SettingsCommand`
  (`viewPorts.ts`).
- `SizingNumberField` moved to `settingsWritePlan.ts` as
  `Exclude<keyof SizingSettings, "metrics">` (was a hand-typed union in
  `sizingRowWrite.ts`) — one more compile-forced declaration, in the spirit of the
  ratified acceptance bar. No existing completeness guard was touched or weakened.
- The settings tab lost every `{...this.store.globalView().sizing, …}` /
  `{...this.store.nodeExclusion(), …}` merge site and its own `persist()` switch,
  `writeContext()`, `applyInteraction()`, `applySizing()`, `applyForceLayout()`,
  `enqueueWrite()` — all of it is the pipeline's now. That switch was **duplicated**
  in `ControlsActions.executeSettings()`; there is one copy left.

### Goal 3 — reset DRAINS the queue before rebuilding `display()`

`SettingsResetSequence.run()` (`settingsResetSequence.ts:41`): flush typed edits →
write defaults → flush again (a field typed into *while* the reset ran) → **drain
the chain** → redisplay. `display()` is no longer called from inside a queued task;
the tab wires the sequence at `VicinityGraphSettingTab.ts:104-111` and both reset
entry points call it (`:291`, `:299`).

`SerialPromiseChain.drain()` (`:44`) loops until the tail stops moving, so it
covers tasks a running task enqueued — that is exactly the racing click. No sleeps,
no delays; the tests are deterministic.

### Goal 4 — ONE refresh fan-out rule

Verified as the exploration map said: `ViewsRefreshPort.refreshAllViews()` was
already the single reach. I **locked it at compile time** rather than adding a
second mechanism or a source-scan test: `VicinityGraphPlugin.refreshOpenViews()` is
now `private` (`src/main.ts:117`) — the settings tab used to call it directly, which
is how a second fan-out rule could have grown. There are now exactly two production
callers of the port: `settingsWritePipeline.ts:111` (all settings writes) and
`ControlsActions.ts:86` (pins). Tested: every-view fan-out and *fan-out-once per
reset scope* in `settingsWritePipeline.test.ts`, pin fan-out in
`ControlsActions.test.ts`.

Also fixed in passing: the panel's force-layout "Restore defaults" used to call
`applySettings` once **per command**, i.e. N fan-outs and N rebuilds for one click.
It is now one `restoreDefaults(scope)` → one fan-out (pinned by the "refreshed
ONCE, not once per command" test).

### Goal 5 — controls stay OPTIMISTIC locally

`src/view/optimisticValue.ts` (`PendingEdits<T>`, immutable, pure) +
`src/view/useOptimisticValue.ts`. Applied to `DepthStepper`, `ForceLayoutSlider`,
`SizingNumber`, the sizing metric checkbox + weight (`SizingMetricRow`), the
exclusion `ToggleSwitch`, and the node-preview radio pill.

The rule (the part that matters): hold the override until the store echoes the
**latest** requested value; a value that was **never requested** wins immediately
(another surface wrote it, or the write path clamped what was typed); an
**abandoned** write releases the override. Reconciling on *any* store change would
flicker a control backwards through its own earlier echoes mid-burst — which is the
lag this goal is about, so the naive rule was not good enough. Correctness lives in
the pure class (9 tests) because the repo has **no React component-test
infrastructure**; the hook is a 5-line wrapper whose only content is React
mechanics (reconcile during render, not in an effect).

---

## Red → green evidence

**Goal 2 (stale snapshot / sibling clobbering) — genuine red→green, verified.**
I temporarily changed `SettingsWritePipeline.apply()` to capture the context
*before* entering the chain (reproducing exactly what the React panel did) and ran
`settingsWritePipeline.test.ts`:

```
× WHEN two sizing numbers are edited before either write is awaited THEN the second keeps the first's value
× WHEN two force-layout sliders are dragged before either write is awaited THEN both values land
× WHEN exclusion is toggled off before an in-flight pattern edit is awaited THEN the patterns survive
  Tests  3 failed | 8 passed (11)
```
Reverted → 11/11 pass. So those three tests demonstrably catch the defect.
(The FIRST write of that pair also caught a real bug in my own test data on the
first run — `maxPx: 900` was silently clamped to 400, which is how I confirmed the
clamp still bites through the granular arm.)

**Goal 3 (reset races display) — red, then green, but at a NEW seam.** I wrote
`settingsResetSequence.test.ts` first and ran it:
`Error: Cannot find module './settingsResetSequence'` → `Tests no tests`. After
implementing: 4/4 pass, including
*"WHEN a control is clicked while the reset is writing THEN the redisplay happens
AFTER that write"*.

Being explicit, because this is weaker than the sizing case: this is **red because
the seam did not exist**, not because I could run the old buggy code against it.
The bug lived in `VicinityGraphSettingTab.applyReset()`, and the tab has **no
vitest harness** (node env, no jsdom, `obsidian` is types-only) — that
untestability is part of why the bug survived. Extracting the ordering into a
port-backed class is what makes it testable at all, and `SerialPromiseChain`'s
`drain()` test independently pins the mechanism it relies on ("a task enqueued
WHILE an earlier one runs is included in the drain"). The tab-level wiring itself
remains e2e-only.

**Goal 5 (optimistic latency) — red-by-absence, same caveat.** No React test
infra, so the behaviour is pinned in `optimisticValue.test.ts` (written before the
class existed). The anti-flicker case is the load-bearing one:
*"WHEN the store echoes an EARLIER request mid-burst THEN the latest request is
still shown"*.

**Chain behaviour**: the three `SettingsWriteQueue` tests (ordering,
rejection-reaches-its-own-caller, rejection-does-not-wedge) moved verbatim in
substance into `SerialPromiseChain.test.ts`, plus four new `drain()` tests. No
behaviour-capturing test was dropped without replacement — one exception, called out
below.

---

## Files

**New**: `src/shared/SerialPromiseChain.ts` (+`.test.ts`),
`src/view/settingsWritePipeline.ts` (+`.test.ts`),
`src/view/settingsResetSequence.ts` (+`.test.ts`),
`src/view/optimisticValue.ts` (+`.test.ts`), `src/view/useOptimisticValue.ts`.

**Deleted**: `src/view/settingsWriteQueue.ts` + `settingsWriteQueue.test.ts`.

**Changed (production)**: `src/main.ts` (pipeline construction; `refreshOpenViews`
private), `src/persistence/PluginDataStore.ts`, `src/view/settingsDebounce.ts`,
`src/view/settingsWritePlan.ts`, `src/view/sizingRowWrite.ts`,
`src/view/ControlsActions.ts`, `src/view/viewPorts.ts`,
`src/view/VicinityGraphView.tsx` (no longer needs `PluginDataStore`),
`src/view/VicinityGraphSettingTab.ts`, `src/view/ControlsModel.ts` (doc: seeds, not
a merge base), and the panel components `GraphToolbar.tsx`,
`GlobalDepthControls.tsx`, `DepthStepper.tsx`, `SizingSection.tsx`,
`NodeContentsSection.tsx`, `NodeExclusionSection.tsx`, `ForceLayoutSection.tsx`.

**Changed (tests)**: `settingsWritePlan.test.ts` (granular arms),
`settingsDebounce.test.ts` (fake pipeline target), `sizingRowWrite.test.ts`,
`ControlsActions.test.ts`, `ControlsModel.test.ts`.

**Docs**: `CLAUDE.md` (one succinct write-path rule),
`docs-internal/architecture-map.md` (pipeline as a key seam),
`docs-internal/plan/high-level-plan.md` (the four user-visible guarantees),
`docs-internal/notes/settings.md` (what ticket 3 adds to the compile-forced family;
field-cost list now names `settingsWritePlan.ts`), `README.md` (two user-facing
sentences).

**No persisted-shape change.** `data.json` and `PersistedShapes` are untouched, so
no clean break and nothing to announce in the release note.

---

## Deliberate rejections

- **A "revision token" threaded through React context** for optimistic
  reconciliation: same mid-burst flicker as the naive rule, plus prop/context
  plumbing through every section.
- **Making the chain re-entrancy-aware** ("am I already inside a task?"): stateful
  trickery. Handing the writer into the slot makes misuse inexpressible instead.
- **Keeping whole-object `global-sizing` / `global-force-layout` and fixing
  freshness by giving React components a store read**: puts a store read in a
  presentational component AND still merges outside the serialised slot.
- **Putting the reset sequence on the pipeline**: the pipeline would need the
  debouncer, which needs the pipeline — a construction cycle. It lives in its own
  class with a port instead.
- **A source-scan guard for the fan-out**: `private refreshOpenViews()` is a
  compile-time lock, which is strictly stronger.
- **Re-seeding controls after every write / disabling the tab during a reset** (the
  other two options the reset ticket listed): the first is the focus-stealing
  repaint pattern `nid_9k11zke41l6ze3p7n7suuo4v2_e` removed; the second makes the
  tab feel broken for a write that normally takes one tick.

## One test removed (called out deliberately)

`sizingRowWrite.test.ts` lost *"WHEN the globals moved after the keystroke THEN the
flushed write composes with them"*. `SizingRowWrite` no longer performs the merge,
so the test had nothing left to assert on that class. The behaviour it protected —
a drained write composing with globals another surface moved — is now covered by
`settingsWritePipeline.test.ts`'s fresh-read tests, which exercise the real code
path rather than a fake's merge. Net test count 1114 → 1113.

## e2e

Not run (release gate). `npm run check:e2e` is clean, and no e2e spec referenced
any removed symbol or changed user-visible copy/DOM (`grep` over `e2e/` for
`settingsWriteQueue`, `applySettings`, the removed interaction kinds: no hits), so
no spec updates were needed. `e2e/settingsResetVerify.e2e.ts` /
`settingsResetReview.e2e.ts` still describe the same user-visible reset behaviour —
they are the tab-level coverage for Goal 3 and are worth re-running before release.

## Suggested follow-up tickets (out of scope, NOT created)

1. **React component-test infrastructure** (jsdom + a light renderer). Three
   behaviours in this change — the optimistic hook's render-time reconciliation,
   the panel rows' wiring, and settings-tab handlers — are only reachable via
   source-scan guards, extracted pure classes, or e2e. This is the recurring cost
   behind "the tab has no vitest harness", and it also blocks a real tab↔panel
   parity test (chain ticket 5).
2. **`console.error` swallowing in `useOptimisticValue` / `SettingsResetSequence` /
   `settlePendingWrites`**: a failed `data.json` write is now logged in three
   places and shown to the user in none. A single `Notice`-on-write-failure policy
   would be one small class; today the user just sees the control snap back.
3. **`engineDefaultsSingleSource.test.ts`'s header prose** still narrates
   `ForceLayoutSection` as the offender; that module no longer imports the reset
   plan at all (it calls `actions.restoreDefaults("force-layout")`). The guard
   itself is correct and green — only the WHY paragraph is now historical.
4. **`SETTINGS_RESET_SCOPES` reset scopes are not exposed on the panel** beyond
   force-layout. Now that `ControlsActionsPort.restoreDefaults(scope)` exists, the
   panel could offer the same per-section restores the tab does — a presenters-ticket
   (chain ticket 4) decision, not this one's.

## `#QUESTION_FOR_HUMAN:` — none

Every goal was reachable without a hack. The one place I would have raised a
question (optimistic-vs-persisted ordering) resolved cleanly: reconcile on the echo
of the LATEST request, let an unrequested value win immediately, release on
abandonment. It is stated as one rule in one pure class with tests, not as
scattered special cases.
