---
id: nid_7qot0m6nuxxmd5z0yb9jylsd6_e
title: 'Test infra: React component tests for the panel controls (jsdom + a light
  renderer)'
status: in_progress
deps: []
links: [nid_m5hxe4eo9jgt7cfic7s2o3uvi_e]
created_iso: '2026-07-30T00:57:03Z'
status_updated_iso: '2026-07-31T17:38:24Z'
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [settings, testing]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
The panel controls (`src/view/*.tsx`) have NO component-test harness: vitest runs in the node environment, there is no jsdom/happy-dom and no react renderer dev-dep. Correctness therefore lives in pure helpers next to the components (`optimisticValue.ts`, `ControlsModel.ts`, `settingsWritePlan.ts`) and the components themselves are covered only by Playwright e2e (a release gate, not `npm test`).

WHY NOW: this cost real correctness once. The optimistic-controls layer shipped in nid_m5hxe4eo9jgt7cfic7s2o3uvi_e was NON-FUNCTIONAL on every code path (the reconciliation rule had no memory of the baseline stored value, so it released the override on the first re-render). Nine passing unit tests on the pure class did not catch it, because the case that always happens in production -- "the store has not moved yet" -- was the one case not enumerated. It was found by review, not by the suite.

What is still NOT pinned by `npm test` today, after that fix:
- that `DepthStepper` feeds the SHOWN value (not the raw `value` prop) into the next click -- the burst behaviour is pinned as a simulation of the component loop in `optimisticValue.test.ts`, not as the component;
- that each control passes the right `SettingsInteraction`/`stored` pair into `useOptimisticValue`;
- that `useOptimisticValue` reconciles DURING render rather than in an effect (the no-flicker property).

SCOPE: add jsdom (or happy-dom) + a minimal react renderer as devDeps, a vitest environment override scoped to component test files only (the rest of the suite must stay node-env -- the source-scan guards read the filesystem), and ONE exemplar component test: rapid + clicks on `DepthStepper` are not dropped.

#DECIDE [RESOLVED 2026-07-31 — moot, see note below]: the reviewer of that ticket asked whether this should be a BLOCKING dependency of settings-cleanup chain step 4 (dual presenters, nid_armoson86j0ii8c33r1odo1rc_e), since step 4 moves more behaviour into React. Owner call: block step 4 on this, or land it alongside? → Step 4 closed 2026-07-30 without this harness; the harness lands after, as follow-up hardening.


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

**2026-07-30T09:04:29Z**

TWO MORE PANEL PROPERTIES ONLY A RENDER CAN PIN (recorded from the nid_9uzrvqv0k5qgckgdaqtgr41ky_e
review, 2026-07-30 — panel per-metric Weight became uncontrolled + blur-committed).

1. A metric's Weight input stays DISABLED while its metric toggle is off
   (`src/view/SettingsRowView.tsx`, SizingMetricRow: `disabled={!enabled}`). A source scan
   could only assert the attribute TEXT exists, which says nothing about the rendered state
   and would pass on an inverted predicate — deliberately not added. Covered by point 3
   above (`disabledWhen` verdicts on both surfaces); listed here so the specific field is
   not forgotten.
2. That a row whose commit was REFUSED renders the refusal element the props describe
   (`aria-describedby` pointing at a rendered `role="alert"`), and that it DISAPPEARS when
   the stored value moves under the field (Restore defaults). The rule itself is now a pure
   seam, `NumberFieldRefusal` in `src/view/numberRowCommit.ts`, unit-tested in
   `numberRowCommit.test.ts`; the wiring of that rule into the markup is not.

**2026-07-31T17:18:53Z**

DECISION RESOLVED (2026-07-31) — the #DECIDE question is moot, overtaken by events.

The question was: should this harness be a BLOCKING dependency of settings-cleanup
step 4 (dual presenters, nid_armoson86j0ii8c33r1odo1rc_e), or land alongside it?

FACTS: step 4 closed 2026-07-30T02:29Z without this harness; the e2e release gate was
run on the dual-presenter branch (nid_que9qloigra7ku2boh83qizz0_e, closed) and the
whole settings-cleanup chain plus its follow-ups are closed. Neither option remains:
the harness lands AFTER step 4, as follow-up hardening. No dependency edge to add —
nothing open depends on this ticket, and this ticket depends on nothing.

CONSEQUENCE FOR SCOPE: unchanged, and strictly MORE valuable now — every gap this
ticket enumerates (component-loop behaviour of DepthStepper, per-row rendered parity
over SETTINGS_GROUPS, disabledWhen verdicts, the refusal-element wiring) is live
shipped behaviour pinned only by e2e (release gate) or by source scans, not by
`npm test`. Ticket stays open as an implementation task at p2.

IMPLEMENTATION RECOMMENDATION (deciding at build time is fine; recorded so the
implementer does not re-litigate): jsdom + @testing-library/react. The acceptance
criteria are phrased in ACCESSIBLE NAMES and rendered disabled/alert states —
exactly what testing-library's role/name queries assert natively; happy-dom's
faster-but-looser DOM is the wrong trade when accessible-name computation is the
point. Keep the environment override scoped per-file (`// @vitest-environment jsdom`
or a `environmentMatchGlobs` entry for `src/view/**/*.component.test.tsx`) so the
source-scan suites stay in node env, as the SCOPE section already requires.

Removing the [decide] tag: all decisions reached.
