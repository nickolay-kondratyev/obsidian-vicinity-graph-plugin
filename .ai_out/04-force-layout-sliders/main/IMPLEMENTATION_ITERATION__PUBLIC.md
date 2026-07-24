# IMPLEMENTATION ITERATION 1 — ticket-04 force-layout sliders (PUBLIC)

Responds to `IMPLEMENTATION_REVIEW__PUBLIC.md` (verdict APPROVED-WITH-MINORS:
0 blocking, 0 major, 2 minor, 1 nit). Each finding critically evaluated, not
blindly accepted.

## Per-finding dispositions

| # | Severity | Disposition | What changed / rationale |
|---|---|---|---|
| 1 | MINOR — untested controller→runner `forceLayout` forwarding (`GraphViewController.ts:213`) | **INCORPORATED** | Valid: the optional-param-with-default design means deleting the argument kept all tests green while the 4 d3 sliders silently no-op. Fix: `FakeLayout` (in `src/view/GraphViewController.test.ts`) now implements the full port signature and records the received settings as `lastForceLayout`; new BDD test *"WHEN a build lays out THEN the graph's resolved force-layout settings reach the layout runner"* resolves a build whose graph carries a NON-default `linkGapPx` (77 — a default value could pass coincidentally) and asserts the fake received exactly those settings. Written failing-first: test observed failing before the fake recorded the arg (`.tmp/t04-iter-ctrl-fail.log`). |
| 2 | MINOR — hand-enumerated fields in `sameForceLayout` (`GraphStructureDiff.ts`), no compile-time exhaustiveness | **INCORPORATED** (reviewer's first suggested direction, the strict-TS one) | Valid: a future 7th field would compile while never triggering live relayout. Fix: `FORCE_LAYOUT_FIELDS = Object.keys(FORCE_LAYOUT_RANGES) as readonly (keyof ForceLayoutSettings)[]` + `.every(field => a[field] === b[field])`. `FORCE_LAYOUT_RANGES` is typed `Record<keyof ForceLayoutSettings, ForceLayoutRange>`, so a new field is a **compile error** until added to the ranges table, at which point it is automatically compared — compile-time construct, no runtime guard, and knowledge stays single-sourced in `src/engine/constants.ts`. WHY comment added at the derivation. Runtime backstop: new `it.each` over the same keys in `GraphStructureDiff.test.ts` asserts every field change forces `"relayout"` (uses `range.max + 1` as a guaranteed-different value). Original single-field and identity-differs tests kept untouched. |
| 3 | NIT — every slider drag tick persists + full relayout rebuild (`VicinityGraphSettingTab.ts`) | **REJECTED — no change** | The reviewer's own suggested direction was "None required; revisit only if observed." Concur: consistent with the existing depth-slider pattern (consistency with existing patterns over one-off optimization), acceptable for a pre-release tuning harness, and a debounce now is speculative complexity (KISS / 80-20) tuned against unobserved jank. If the human's real-vault tuning pass feels janky, a follow-up ticket should debounce the pattern wholesale (all sliders), not this one alone. |

## Failing-test-first note

Finding 1: yes (see above). Finding 2: the defect is a *future* compile-time gap —
no failing runtime test exists for it today; per instructions the fix is a
strict-TS construct, and the new `it.each` was confirmed passing against both the
old and new implementations (semantics-preserving refactor, verified by the
suite).

## Verification

| Check | Result | Log |
|---|---|---|
| `npm test` | **PASS** — 60 files / 729 tests (722 at review + 7 new) | `.tmp/t04-iter-test.log` |
| `npm run check` (tsc strict) | **PASS** | `.tmp/t04-iter-check.log` |
| Ticket-03 stranding test | Not in diff (`git diff --name-only` clean of it), green in suite | `.tmp/t04-iter-test.log` |
| Defaults behavior-identical | Yes — only production change is the `sameForceLayout` refactor (same semantics, covered by unchanged + new tests); everything else is test code | — |

## Files touched this iteration (3)

- `src/view/GraphStructureDiff.ts` — `FORCE_LAYOUT_FIELDS` derivation + `sameForceLayout` rewrite (finding 2)
- `src/view/GraphStructureDiff.test.ts` — `it.each` per-field relayout guard (finding 2)
- `src/view/GraphViewController.test.ts` — recording `FakeLayout` + forwarding test (finding 1)

Nothing committed (TOP_LEVEL_AGENT commits).

#QUESTION_FOR_HUMAN: none.

## Readiness signal

**READY**
