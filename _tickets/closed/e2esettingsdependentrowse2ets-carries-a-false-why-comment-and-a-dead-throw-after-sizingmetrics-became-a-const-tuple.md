---
closed_iso: 2026-07-30T07:28:00Z
id: nid_zwhec6kznw0utd9sz0n5g60ex_e
title: "e2e/settingsDependentRows.e2e.ts carries a false WHY comment and a dead throw after SIZING_METRICS became a const tuple"
status: closed
deps: []
links: []
created_iso: 2026-07-29T19:43:10Z
status_updated_iso: 2026-07-30T07:28:00Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, e2e, tech-debt]
---

Found during IMPLEMENTATION_REVIEW of the settings descriptor model (ticket nid_wimjq4ewgbg21n4zx9d4qq3a0_e).

FILE: e2e/settingsDependentRows.e2e.ts:44-50

When `SIZING_METRICS` (src/view/sizingMetrics.ts) gained `as const satisfies` and became a const tuple, `SIZING_METRICS[0]` stopped being optional under `noUncheckedIndexedAccess`. Two consequences at the referenced lines:

1. The WHY comment claims `noUncheckedIndexedAccess makes [0] optional` — that statement is now FALSE. A false WHY comment is worse than no comment: it teaches the next maintainer something untrue about the type system.
2. The `if (!METRIC_UNDER_TEST) throw ...` guard is now structurally unreachable dead code.

It still compiles and all tests pass, so this is not urgent — it was left alone deliberately during the descriptor-model ticket because the owner decision D1 for that ticket explicitly ruled out e2e churn.

FIX: delete the dead throw and the false comment. Verify with `npm run check` (which runs check:e2e) and `npm test`.

WHY-NOT-part-of-the-original-ticket: owner decision D1 scoped the descriptor-model ticket to zero e2e churn, so that the e2e baselines staying untouched remained a meaningful signal that no user-facing behaviour changed.


## Notes

**2026-07-30T07:28:00Z**

Done in commit ec70c00. Deleted the false 'noUncheckedIndexedAccess makes [0] optional' sentence and the unreachable 'if (METRIC_UNDER_TEST === undefined) throw' from e2e/settingsDependentRows.e2e.ts; kept the still-true 'read from the shared table so a renamed metric fails HERE' rationale. Also removed a SECOND comment made false by the same deletion: the justification for expectMetricEnabledPersisted's arrow-const form read 'a hoisted declaration is callable before the throw above' — leaving it would have recreated this ticket's exact defect. No production code, no e2e baselines touched. Verified: npm run check (incl. check:e2e) exit 0, npm test exit 0 (1245 tests). check:e2e passing with the narrowing gone IS the proof the throw was dead. npm run test:e2e not run (release gate, needs a real Obsidian binary). Reviewer verdict: CONVERGED. Noted-not-fixed (out of scope): expectExclusionPersisted is an async function while its sibling is an arrow const — cosmetic asymmetry that used to have a written reason; src/view/sizingMetrics.ts exports _assertEverySizingMetricListed with no runtime consumer.
