# PRIVATE memory — `nid_zwhec6kznw0utd9sz0n5g60ex_e`

## Status: COMPLETE. Nothing left to do. Not committed.

No prior PRIVATE file existed; this was a cold start, output dir did not exist and I created it.

## Plan (all steps done)

1. Read `src/view/sizingMetrics.ts` to settle the optionality judgement call — DONE, non-optional.
2. Delete the false sentence from the `METRIC_UNDER_TEST` doc comment — DONE.
3. Delete the dead `if (… === undefined) throw` — DONE.
4. `npm run check` — DONE, exit 0.
5. `npm test` — DONE, exit 0, 1245 passed.
6. Write PUBLIC + PRIVATE — DONE.

## Key facts for anyone rehydrating

- `SIZING_METRICS` = `as const satisfies readonly SizingMetricLabel[]`, 5 literal entries,
  element 0 is `{ id: "own-file-size", label: "Own file size" }`. Const tuple ⇒ `[0]` is
  non-optional even under `noUncheckedIndexedAccess`. Judgement call resolved: guard was dead,
  the STOP condition in the ticket did NOT trigger.
- The load-bearing verification is `check:e2e`. `METRIC_UNDER_TEST.id` / `.label` are dereferenced
  at three sites in the spec (lines ~193, ~259 twice, ~263). With the narrowing guard gone, those
  compile only because the tuple element is non-optional. That is the falsifiable proof, not my
  reading of the source.

## Deviation from the ticket's stated line range — the one thing a reviewer may push back on

I deleted two extra comment lines above `expectMetricEnabledPersisted` (was ~line 194) that
justified the arrow-const form by "the throw above". Deleting the throw made that comment false,
which is the same class of defect the ticket fixes. Rationale is written up in PUBLIC. The arrow
const itself was left alone — no behavior/style change, comment-only.

I did NOT convert it to a `function` declaration. Deliberate: that would be gratuitous churn on a
minimal-cleanup ticket, and the arrow form is harmless.

## Scope discipline held

- `src/view/sizingMetrics.ts`: read only, NOT modified.
- e2e baselines / screenshots: untouched.
- Two unrelated observations recorded in PUBLIC for follow-up tickets, not patched.

## Verification artifacts

`.tmp/check.log` (exit 0), `.tmp/test.log` (exit 0, 94 files / 1245 tests).
`npm run test:e2e` intentionally NOT run — release gate, needs real Obsidian. Stated honestly in
PUBLIC rather than implied green.

## Final diff shape

`e2e/settingsDependentRows.e2e.ts` only, 1 insertion / 8 deletions.
