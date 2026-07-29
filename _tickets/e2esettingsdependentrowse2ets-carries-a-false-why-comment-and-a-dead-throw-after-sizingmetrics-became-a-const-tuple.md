---
id: nid_zwhec6kznw0utd9sz0n5g60ex_e
title: "e2e/settingsDependentRows.e2e.ts carries a false WHY comment and a dead throw after SIZING_METRICS became a const tuple"
status: open
deps: []
links: []
created_iso: 2026-07-29T19:43:10Z
status_updated_iso: 2026-07-29T19:43:10Z
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

