# IMPLEMENTATION REVIEW — step-06-controls

**Reviewer:** IMPLEMENTATION_REVIEWER · **Date:** 2026-07-20 · **Range:** `9c51aab..3c56520` (Phases A–D)

## Verdict: **APPROVE-WITH-FOLLOWUPS**

The step is implementation-complete and matches the spec, the approved plan, and the binding
CLARIFICATION decisions. Architecture is clean: a pure, well-tested "which write lands where" core
(`planSettingsWrite`, `ControlsModelBuilder`, `PinnedRootResolver`, `planNodePinAction`) with thin
obsidian/React glue over it. Every settings mutation on every surface (toolbar depth steppers, in-view
sizing mirror, settings tab) routes through the single `planSettingsWrite` contract — the field-merge
business rule exists exactly once. No Critical issues, no blocking Important issues. A few Minor cleanups
and one UX follow-up ticket.

## Gate results (independently run)
| Gate | Result |
|------|--------|
| `npx vitest run` | **49 files / 499 tests passing** (exit 0) |
| `npm run check` (`tsc -noEmit`) | **clean** (exit 0) |
| esbuild production | Not re-run; impl reports OK, tsc clean → low risk |

## Requirements coverage vs `step-06-controls.md`
| Requirement | Status |
|-------------|--------|
| Per-direction depth steppers (MAIN + pinned centrals) | ✅ `CentralDepthControls` + `DepthStepper` ×2 |
| Pin-on-toggle (write even == global) | ✅ `planSettingsWrite` never inspects value; tested |
| Reset-to-global = field delete (`undefined`) | ✅ end-to-end; delete tested in `DocDataMutations.test.ts` |
| Inherited-vs-pinned visual distinction | ✅ `data-pinned` presence-based (not value-diff) |
| Node pin/unpin — hover button + context menu | ✅ both share `planNodePinAction`; MAIN not pinnable on both |
| Not-pinnable Notice | ✅ `ControlsActions` on `not-persistable` identity |
| Sizing section (global) | ✅ `SizingSection`, shared write path |
| Node cap (global settings tab only, Q4) | ✅ tab-only, guarded int ≥1 |
| PluginSettingTab | ✅ `NeighborhoodGraphSettingTab` + `refreshOpenViews` fan-out |
| Clamp 0..5 everywhere | ✅ steppers + tab slider via `clampStepperDepth` |
| Exit: every goal-3/4 behavior operable from UI | ✅ |
| Exit: no orphaned UI | ✅ every control maps to a tested engine/persistence path |

## Correctness — traced, no bugs found
- **`planSettingsWrite`** — pin-on-toggle emits a write regardless of equality to global; reset carries
  `value: undefined`; whole-object commands merge exactly one field from `ctx`. Reaches
  `DocDataMutations` field-delete via `setDocDepthField`/`setCentralDepthField(…, undefined)` (verified
  delete + prune in `DocDataMutations.ts`/`.test.ts`).
- **`ControlsModelBuilder`** — `value` derived through `TraversalSettingsResolver.resolveForRoot` (same
  function the engine uses → shown == graphed, structurally). `pinned` is a *separate* per-field presence
  check on the OWNED layer. Q-A honored: a pinned central's `pinned` reflects only `MAIN.centralDepths[X]`;
  a central pinned solely via its own depths reads "inherited" (as designed).
- **`ControlsActions`** — awaits the persistence write *before* `handleSettingsChanged()`; `currentMainPath()`
  null → silent no-op; correct `PersistenceServices`/`PluginDataStore` dispatch per command kind.
- **`GraphViewController.handleSettingsChanged`** — immediate rebuild, clears pending debounce, monotonic
  `rebuildToken` latest-wins absorbs stepper/slider bursts. Re-reads fresh disk state on rebuild.
- **Settings tab** — reads globals *fresh* per edit so successive edits compose; merges one field via the
  shared planner (no clobbering); `refreshOpenViews()` narrows leaves with `instanceof NeighborhoodGraphView`.
- **`PinnedRootResolver` refactor** — assembler now calls the shared resolver once; output unchanged
  (pre-existing assembler tests green). docid resolution for unpin flows through `FlowNodeData.docid`
  (centrals only). MAIN not pinnable on both surfaces (`planNodePinAction("main") → none`).

## Test adequacy — sufficient
- Scenario (a) `CentralDepthRoundTrip.test.ts`: X's override = `{...Xown, ...Y.centralDepths[X]}` while Y is
  main; falls back to X-own at Z; restores exactly at Y again; **X's own DocData byte-identical throughout**.
- Scenario (b) `NeighborhoodEngine.test.ts`: BFS actually re-walks X to depth 3 (x3 reached) in builds 1 & 3,
  out of reach at own depth 1 in build 2. Together (a)+(b) prove the headline claim end-to-end.
- Pin-on-toggle-equals-global asserted (`ControlsModel.test.ts` + `settingsWritePlan.test.ts`);
  reset(undefined) asserted at the planner + mutation layers. No false-pass tests spotted.

## Loss-of-functionality check — clean
No test files deleted, no behavior-capturing tests removed, no anchor-point removals. The assembler
refactor preserves output. No obsidian import leaked into the pure/controller layers.

---

## 🚨 Critical
None.

## ⚠️ Important
None blocking.

## 💡 Minor (non-blocking cleanups)
1. **Direction→field mapping duplicated.** `settingsWritePlan.ts:56` (`fieldOf`) and `ControlsModel.ts:56`
   (`DIRECTION_FIELD`) both encode `outgoing→outgoingDepth / incoming→incomingDepth`. Trivial, but per the
   DRY guideline a single shared const/helper (e.g. exported from `engine` or a `depthDirection.ts`) removes
   the second copy. Low priority.
2. **Dead-defensive `central.docid ?? ""`** (`CentralDepthControls.tsx:33`). `editable` already requires
   `central.docid !== undefined` for pinned rows, so the `?? ""` branch is unreachable. Either drop it (rely
   on `editable`) or assert non-null for clarity.

## 🧭 Nice-to-have (follow-up ticket, not this step)
3. **Stepper rapid-click responsiveness.** `DepthStepper` is fully controlled off the snapshot value; each
   `+`/`−` computes from the closed-over `value` and only reflects the new value after a full write→build→layout
   round-trip. Rapid clicks before the rebuild lands re-send the same base value, so increments coalesce — the
   user must pause between clicks to climb. **Not data loss** and bounded by `MAX_STEPPER_DEPTH = 5`, so
   acceptable for V1. A future optimistic local-value ticket (debounced flush) would make the steppers feel
   instant. Recommend logging a ticket; do not block ship.

## Deviations — all ACCEPTED
1. **Pinned centrals behind a disclosure** (MAIN always visible) rather than always-visible. **Accept** —
   binding CLARIFICATION Q1 states exactly this ("pinned centrals … behind expand/disclosure toggles"); the
   task's item-10 phrasing is superseded by Q1.
2. **Notice emitted inside `ControlsActions`** instead of a `GraphUiPort.showNotice` port. **Accept** — KISS;
   `ControlsActions` is already an obsidian-glue file, so a dedicated port would be ceremony with no testability
   gain (the write executor is not unit-tested by design).
3. **Only `SIZING_METRICS` extracted; whole-object sizing spreads inline.** **Accept** — the label/order list
   was the real knowledge duplication; the spreads are trivial one-liners and both surfaces still share the one
   `planSettingsWrite` write path.

## Documentation updates needed
None required for CLAUDE.md / deep memory. The `.ai_out` implementation notes already capture the deviations
accurately. (If the human wants item-3 tracked, add `ticket-stepper-optimistic-value.md` to the step's tickets.)

## Recommended path to closeout
Ship as-is (APPROVE). Optionally sweep Minor 1–2 in a tiny cleanup commit; file the rapid-click ticket. Then run
the plan §13 manual QA through an Obsidian restart (persistence + live cross-surface refresh), which is the only
coverage the pure/unit suite structurally cannot provide.
