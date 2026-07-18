# IMPLEMENTATION_REVIEW__PUBLIC — step-04-view-shell (main)

Reviewer: IMPLEMENTATION_REVIEWER. Target: commit c920e7d.

## Verdict: READY
All gates green, all requirements met, no BLOCKING issues. One meaningful test-gap
SHOULD-FIX (controller latest-wins) worth a follow-up ticket; the rest are NICE-TO-HAVE.
The pipeline is well-decomposed: thin ItemView, pure node-tested decision modules, a
single Obsidian-facing controller. Concurrency (latest-wins) and the size boundary were
verified correct by reading.

## Gate results (independently run)
- `npx vitest run` → **325 passed / 35 files**, exit 0.
- `npm run check` (`tsc -noEmit`) → exit 0.
- `npm run build` (production esbuild) → exit 0; artifacts copied to `.dev-vault`.
- Bundle sanity: `main.js` 1.84 MB; contains `@xyflow/react` + `elkjs` + `createRoot`;
  `react`/`react-dom` correctly NOT external. `styles.css` generated (19 KB, 138 RF rules)
  and NOT git-tracked (the commit already removed it — implementer's `git rm --cached`
  callout is RESOLVED).

## Requirements coverage

| Requirement | Met? | Note |
|---|---|---|
| ItemView + React 18 root, view type registered | Yes | `NeighborhoodGraphView`, `registerView` in main.ts, StrictMode createRoot. |
| Right sidebar default, draggable to main | Yes | `activateView` uses `getRightLeaf(false)`; draggable is default ItemView behavior. |
| graphBuilder wired into view | Yes | Passed through `registerView` closure (main.ts:65). |
| MAIN tracking follows active file; ignores non-eligible | Yes | `decideActiveFileRebuild` + `FileKinds.isNodeBearingPath` (md/canvas). Tested. |
| Per-leaf getState/setState; no scroll/zoom persist | Yes | Thin super-delegating overrides (CLARIFICATION Q4). Per-instance state → no cross-contamination with multiple views. |
| Rebuild pipeline events→engine→diff→elk→RF | Yes | `GraphViewController.runRebuild`. |
| Triggers: active-file change + debounced resolve (500ms, named) | Yes | `active-leaf-change`/`file-open`/`resolved`; `REBUILD_DEBOUNCE_MS=500`. |
| Structural diff skips layout, refreshes data; size exception at 1.0 (+100%) | Yes | `decideLayout`; boundary `> threshold` (exactly +100% → reuse). Correct & tested. |
| Latest-wins via monotonic token, no sleeps | Yes | `++rebuildToken`, `isStale` after both awaits. Race-free. |
| elkjs layered + INCLUDE_CHILDREN, compound-ready, inline async | Yes | `ELK_LAYOUT_OPTIONS`; `extractElkPositions` accumulates parent offsets. |
| Plain RF nodes w/ titles; pan/zoom/fit-view; click opens note | Yes | `NeighborhoodGraphFlow` default nodes, `fitView`, `Controls`, `onNodeClick`. |
| Handles build() null / empty | Yes | `graph === null || nodes.length === 0 → reset` → empty snapshot + empty-state UI. |
| Nothing from step 05/06 pulled in | Yes | No groups/rich nodes/toolbar. |
| Pure modules don't import obsidian/React; node-testable | Yes | Verified: mappings/diff/decision/identity are import-clean; elk uses `import type`. |
| Tests BDD, ~1 assert, structural fakes, real elkjs headless, no RF mount | Yes | Confirmed across 5 suites + fixtures. |

## Findings

### 1. [SHOULD-FIX] GraphViewController latest-wins/reset logic is untested
`src/view/GraphViewController.ts` imports Obsidian, the builder and the layout runner all
via `import type` — it is fully node-testable with fakes, yet has **zero tests**. This is
the step's trickiest logic and the explicitly flagged key risk (CLARIFICATION Q2:
active-file-change-mid-rebuild). The token guard is correct on inspection, but "correct by
reading" is exactly what CLAUDE.md testing standards push back on for concurrency-sensitive
code. Suggested: a small suite with a fake builder whose `build()` resolves on demand,
asserting (a) a stale in-flight result is discarded when a newer rebuild supersedes it, and
(b) reuse-layout preserves prior positions while relayout replaces them. (The `window.setTimeout`
debounce can stay out of scope or use fake timers.) Non-blocking: a follow-up ticket is fine.

### 2. [NICE-TO-HAVE] Active-file change doesn't cancel a pending resolve-debounce
`handleActiveFileChanged` (line 78) runs a rebuild immediately but leaves any pending
`debounceTimer` armed, so a queued metadata-resolve rebuild fires a second, redundant
rebuild shortly after. Harmless (the structural diff makes it a reuse-layout data refresh),
but a `this.clearDebounce()` at the top of `handleActiveFileChanged` removes the wasted pass.

### 3. [NICE-TO-HAVE] `console.debug` reuse-layout log is always-on
`GraphViewController` line 126 logs on every skipped layout. It satisfies the exit criterion
("provably skip layout — log in dev build") and matches the codebase's existing console usage,
but is unconditional in production. Consider a debug gate later; acceptable for V1.

### 4. [NICE-TO-HAVE / verify in smoke] `openNode` uses `getLeaf(false)`
Opening in the active leaf is correct because Obsidian's `getLeaf` targets a main-area leaf,
not the sidebar hosting the graph — so clicking a node should open in the editor, not replace
the graph. Worth an explicit check in the dev-vault smoke run (report step 3) since it hasn't
been exercised yet.

### 5. [NICE-TO-HAVE] getState/setState overrides only call super
`NeighborhoodGraphView.getState/setState` add nothing over the base class today. Retained as
documented step-06 anchors with a clear WHY comment — acceptable, but technically dead
delegation until per-view settings exist.

## styles.css design recommendation
**Keep the generate-at-build-time approach; it is robust and I recommend it over vendoring.**
- Correctness: `esbuild` `onStart` regenerates `styles.css` = `@xyflow/react/dist/style.css`
  + `src/view/graph-view.css` before every build, and the `onEnd` copy ships it to `.dev-vault`.
  Verified the generated file (138 RF rules + authored rules) and that the copy path runs. It
  can never drift from the installed RF version — a genuine advantage over a committed copy.
- Fail-loud: if RF changes its dist path, `readFileSync` throws and the build fails visibly
  (no silent fallback) — consistent with EARN_TRUST.
- Failure mode to note: `styles.css` is gitignored, so a fresh checkout has no CSS until a
  build runs. This is identical to `main.js` (also generated/gitignored), so anyone loading
  the plugin already must build first — no NEW footgun. **Action for release:** ensure the
  future packaging/release step runs `npm run build` so the release bundle includes the
  generated `styles.css` alongside `main.js` + `manifest.json`. Recommend documenting that in
  the release workflow when it's authored (not needed this step).

## Open questions for human
- `#QUESTION_FOR_HUMAN:` None blocking. Optional: is a follow-up ticket for GraphViewController
  latest-wins unit tests (finding #1) acceptable, or do you want them in this step before merge?

---

## Round 2 / Convergence — verdict: CONVERGED-READY

Reviewed the iteration delta (commit `057ccf0`) as a focused delta review. Gates re-run
independently, all green: `npx vitest run` → **335 passed / 36 files** (exit 0);
`npm run check` (`tsc -noEmit`) → exit 0; `npm run build` → exit 0, artifacts copied to `.dev-vault`.

The implementer and I have converged: both signal readiness.

### Round-1 finding dispositions (all resolved or consciously deferred)
- **#1 [SHOULD-FIX] controller latest-wins untested — RESOLVED (the material one).** Rather than
  a superficial test, the controller was made a clean DIP citizen: obsidian navigation extracted
  behind `NoteNavigatorPort` (`viewPorts.ts` + `ObsidianNoteNavigator.ts`), so `GraphViewController`
  now has ZERO obsidian/elkjs/builder runtime coupling. `GraphViewController.test.ts` (10 BDD tests)
  drives concurrency with DEFERRED build promises resolved out-of-order via explicit `resolveBuild(i,…)`
  — **no sleeps/timers**. The tests are REAL and non-tautological: they assert on observable snapshot
  state and the fake layout's `callCount`, not on internals.
    - Latest-wins: stale earlier build resolves first → snapshot stays `empty` (discarded), layout
      `callCount === 0` (never reaches elk), and only the newest graph's node id renders (`["b.md"]`).
      I traced the token flow: build[0]'s continuation sees `isStale(1)` (token now 2) and returns
      before diff/layout/publish. Correct.
    - null / empty-nodes → empty snapshot; non-node-bearing (`pic.png`) → no `build` call
      (`FileKinds.isNodeBearingPath` gating); reuse-layout preserves prior positions and keeps
      `callCount === 1`; node-set change relayouts (`callCount === 2`); `openNode` delegates to navigator.
- **#2 [NICE] clearDebounce on active-file change — RESOLVED, correct.** `handleActiveFileChanged`
  now calls `clearDebounce()` only on the rebuild branch (after the `ignore` early-return), so an
  `ignore` outcome correctly leaves a pending resolve-debounce armed. Cancels the redundant second pass.
- **#3 [NICE] always-on console.debug — KEPT (agreed).** `console.debug` is the lowest severity,
  hidden by default in the Obsidian/Chromium console; gating it would require a new esbuild `define`
  and risk perturbing React's NODE_ENV branching. Reasonable Pareto call for V1.
- **#4 [NICE] openNode getLeaf(false) — behaviour UNCHANGED**, logic simply relocated into the
  navigator adapter (documented there). Still worth the dev-vault smoke check.
- **#5 [NICE] getState/setState no-op — KEPT (agreed)**, intentional per CLARIFICATION Q4;
  documented step-06 anchors.

### Port seam assessment
`viewPorts.ts` is a narrow, types-only DIP boundary (three focused interfaces) consistent with
`adapters/obsidianPorts.ts` conventions. `NeighborhoodGraphBuilder`/`ElkLayoutRunner` satisfy the
first two structurally (production wiring unchanged; tsc green confirms structural conformance).
`ObsidianNoteNavigator` is a thin adapter; the ItemView got thinner and DRY-er (the duplicated
`activeFilePath` that lived in both ItemView and controller is now single-sourced in the navigator).
The ItemView reuses the navigator for event wiring. Behaviour preserved, not changed.

### New findings
None. No regressions, no scope creep. The delta is tightly scoped to the review feedback.
