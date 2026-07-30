---
id: nid_7qot0m6nuxxmd5z0yb9jylsd6_e
title: "Test infra: React component tests for the panel controls (jsdom + a light renderer)"
status: open
deps: []
links: [nid_m5hxe4eo9jgt7cfic7s2o3uvi_e]
created_iso: 2026-07-30T00:57:03Z
status_updated_iso: 2026-07-30T00:57:03Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [settings, testing, decide]
---

The panel controls (`src/view/*.tsx`) have NO component-test harness: vitest runs in the node environment, there is no jsdom/happy-dom and no react renderer dev-dep. Correctness therefore lives in pure helpers next to the components (`optimisticValue.ts`, `ControlsModel.ts`, `settingsWritePlan.ts`) and the components themselves are covered only by Playwright e2e (a release gate, not `npm test`).

WHY NOW: this cost real correctness once. The optimistic-controls layer shipped in nid_m5hxe4eo9jgt7cfic7s2o3uvi_e was NON-FUNCTIONAL on every code path (the reconciliation rule had no memory of the baseline stored value, so it released the override on the first re-render). Nine passing unit tests on the pure class did not catch it, because the case that always happens in production -- "the store has not moved yet" -- was the one case not enumerated. It was found by review, not by the suite.

What is still NOT pinned by `npm test` today, after that fix:
- that `DepthStepper` feeds the SHOWN value (not the raw `value` prop) into the next click -- the burst behaviour is pinned as a simulation of the component loop in `optimisticValue.test.ts`, not as the component;
- that each control passes the right `SettingsInteraction`/`stored` pair into `useOptimisticValue`;
- that `useOptimisticValue` reconciles DURING render rather than in an effect (the no-flicker property).

SCOPE: add jsdom (or happy-dom) + a minimal react renderer as devDeps, a vitest environment override scoped to component test files only (the rest of the suite must stay node-env -- the source-scan guards read the filesystem), and ONE exemplar component test: rapid + clicks on `DepthStepper` are not dropped.

#DECIDE: the reviewer of that ticket asked whether this should be a BLOCKING dependency of settings-cleanup chain step 4 (dual presenters, nid_armoson86j0ii8c33r1odo1rc_e), since step 4 moves more behaviour into React. Owner call: block step 4 on this, or land it alongside?


## Notes

**2026-07-30T03:26:24Z**

RESIDUAL PARITY GAP THIS TICKET WOULD CLOSE (recorded from nid_x6hgehsu5il1d1shuraz3ufqy_e review, 2026-07-29).

src/view/settingsRowParity.test.ts is a SOURCE SCAN, so tab/panel parity is currently
inferred, not observed. What it proves: every declared control KIND has a `case` in both
presenter sources (comments stripped, so a commented-out `case` no longer counts), both
switches are closed by `unhandledRowControl`, both section walkers read SETTINGS_GROUPS /
SETTINGS_SECTIONS, and no row-rendering module hard-codes a declared row LABEL (a row's
only identity in the model), which blocks the realistic per-row special case.

What it still CANNOT prove, and what a jsdom/@testing-library harness here would:
1. That a `case` actually RENDERS a control (a scan sees the label, not the DOM).
2. Per-row parity against an INDEX- or PREDICATE-based subset of a block's rows
   (`rows.slice(1)`, `rows.filter(pred)`) — such a skip names no row, so the label scan
   misses it.
3. Rendered accessible names (SettingsRowNames), render ORDER, and `disabledWhen` verdicts
   on both surfaces.

Acceptance addition for this ticket: render both surfaces over SETTINGS_GROUPS and assert,
per row in EVERY_SETTINGS_ROW, that each surface produced a control whose accessible name
is the declared one, in declared order — then the source scan can shrink to the checks a
render cannot make.
