# IMPLEMENTATION_REVIEW — PRIVATE (rehydration state)

Reviewed `c5b5316..HEAD` on branch `e2e-controls-panel-disclosure-exhaustiveness`.
Verdict issued: **READY, 0 blocking** (S1 SHOULD + N1/N2/N3 NICE-TO-HAVE).

## What I checked, and how

1. `git diff c5b5316..HEAD --stat` → only `e2e/settingsBaseline.ts`,
   `e2e/settingsUxVisual.e2e.ts`, 2 `.ai_out` docs. Confirms the temporary proof disclosure
   in `src/view/GraphToolbar.tsx` was truly reverted. `git status` clean.
2. Read `src/view/GraphToolbar.tsx:37-60` — 5 unconditional top-level `<Disclosure>` (Depth,
   NodeExclusionSection, SizingSection, NodeContentsSection, ForceLayoutSection), all direct
   children of `.vicinity-graph-toolbar__body`; "Pinned centrals (n)" conditional at :46-52 IS
   a direct child. `ForceLayoutSection.tsx:50` "Advanced spacing" is nested → excluded by the
   `>` chain. `Disclosure.tsx:29,34` always emits both class names, so the selector is sound.
3. `NodeExclusionSection.tsx:44-56` — summary = label span + optional bare-integer count span.
   Confirms (a) the prefix-regex motivation is real, (b) `\d*$` tail anchor is safe.
4. Ran `npm run check` (exit 0) and `npm test` (exit 0, 990 tests) → `.tmp/check.log`,
   `.tmp/test.log`. Did NOT re-run e2e; instead audited the claimed logs:
   `.tmp/e2e-proof.log:267-271` has the real `Expected: 5 / Received: 6` with locator string,
   `.tmp/e2e-after-revert.log` tail `18 passed`. Timestamps (16:42/16:43) match the commit.
   Judged credible; no reason to spend the heavy e2e run.
5. Behavior preservation: per-entry open-state loop at `settingsUxVisual.e2e.ts:61-72`
   untouched; no `ap_` anchors in either touched file (`grep`); diff is purely additive.

## Rationale for NOT blocking on S1

Prefix matching still satisfies the stated acceptance criterion (a NEW unlisted disclosure
fails on count AND on the text array). The weakness is only against prefix-preserving RENAMES,
which is a narrower hole than the one being closed, and the sibling tab assertion covers the
same class of risk with exact strings so the inconsistency is visible to maintainers. Cheap
one-token fix, hence SHOULD, not BLOCKING.

## If asked to re-review after fixes

Only need to re-read `e2e/settingsUxVisual.e2e.ts:88-112` and confirm a scoped
`npm run test:e2e -- settingsUxVisual` still passes (the `\d*$` anchor and the regex
`hasNotText` are both runtime-only changes; `npm run check` will not catch a mistake there).
Full e2e suite is pre-existing RED at `e2e/vicinityGraph.e2e.ts:160`
(`nid_yccejkvl0ccqc77olsgg5deka_e`) — unrelated.
