# Ticket `nid_zwhec6kznw0utd9sz0n5g60ex_e` — false WHY comment + dead throw — DONE

## Judgement call the ticket asked me to own

**Confirmed: `SIZING_METRICS[0]` is NOT optional.** `src/view/sizingMetrics.ts` declares it
`as const satisfies readonly SizingMetricLabel[]` over five literal elements, so the type is a
const tuple whose element 0 is present. `noUncheckedIndexedAccess` does not widen a tuple's
in-range index to `| undefined`. The guard was structurally unreachable — deleting it was safe,
and I did not hit the STOP condition.

The strongest proof is not my reading but `npm run check:e2e`: after the `if (… === undefined)`
narrowing was removed, `METRIC_UNDER_TEST.id` and `METRIC_UNDER_TEST.label` still type-check.
Had `[0]` really been optional, those property accesses would now be errors.

## What changed

One file, `e2e/settingsDependentRows.e2e.ts`, -8/+1 lines. No production code touched, no
`src/view/sizingMetrics.ts` change, no e2e baselines or screenshots touched.

1. **Doc comment on `METRIC_UNDER_TEST`** — dropped the false sentence claiming
   `noUncheckedIndexedAccess` makes `[0]` optional. Kept the still-true rationale (read from the
   shared table rather than re-typed, so a renamed metric fails HERE instead of drifting).
2. **`if (METRIC_UNDER_TEST === undefined) throw …`** — deleted as dead code.

## One in-scope addition beyond the ticket's line range — called out deliberately

The ticket scoped the change to lines 44-55. I also deleted a two-line comment above
`expectMetricEnabledPersisted` (~line 194) that read: *"An arrow const, not a `function`
declaration: a hoisted declaration is callable before the throw above, so TS would not see
`METRIC_UNDER_TEST` as narrowed."*

That comment justified itself **entirely by the throw I had just deleted**. Leaving it would have
recreated the exact defect this ticket exists to fix — a comment asserting something untrue about
the file — and it would have pointed a future maintainer at a `throw above` that is not there.
I removed only the stale justification; `expectMetricEnabledPersisted` is still an arrow const,
so there is no behavior or style change, just the removal of a now-false WHY.

If the reviewer considers this out of scope, reverting those two lines is independent of the rest.

## Verification (actually run, full output in `.tmp/`)

| Command | Result |
|---|---|
| `npm run check` (`tsc -noEmit` + `check:e2e`) | **exit 0**, clean |
| `npm test` (vitest) | **exit 0** — 94 files passed, 1245 tests passed |

No pre-existing failures observed in either command; both were green on the first run.

**Not run: `npm run test:e2e`.** It is the release gate and needs a real Obsidian binary. The
change is a comment deletion plus removal of a never-taken branch, so the spec's runtime behavior
is unchanged — but I am stating plainly that I did not execute the e2e suite, so that claim rests
on the type-check and on the code being unreachable, not on an observed green e2e run.

## Unrelated observations — NOT fixed, candidates for follow-up tickets

- `src/view/sizingMetrics.ts:39` exports `_assertEverySizingMetricListed`, a compile-time-only
  const with an underscore-prefixed name. It is a legitimate type guard, but it is exported into
  the module's public surface where nothing consumes it at runtime. Possible tidy-up, low value.
- The doc comment on that same guard says "The unit test stays: it additionally catches a metric
  listed TWICE." I did not verify that such a unit test still exists. Worth a check if anyone
  touches that file.

## Housekeeping

Not committed (orchestrator owns git). Change log not written, ticket not closed, per instructions.
