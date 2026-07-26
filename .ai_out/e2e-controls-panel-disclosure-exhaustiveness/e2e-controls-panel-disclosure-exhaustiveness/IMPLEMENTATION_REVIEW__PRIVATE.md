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

---

# Round 2 (iteration confirmation) — reviewed `9262aa8..HEAD` (single commit `06a97fe`)

Verdict: **READY, 0 blocking**. Round-1 S1 + N1 landed as code; N2/N3 landed as tickets
(`nid_d9j4o9ecp93g5zhury5m1fb43_e`, `nid_iwd08rsdnsbdziltw1odisuoc_e`).

## What I checked

1. Diff is `e2e/settingsUxVisual.e2e.ts` (regexes + comment), `e2e/settingsBaseline.ts`
   (doc comment only), 2 `.ai_out`, 2 `_tickets/`. No `src/`, no deletions, tree clean.
2. Regex reasoning, all four cases: no badge (`\d*` → empty), 1 digit, 2+ digits, and
   over-tightness (rename must fail). Escaping of the summary text retained.
3. `hasNotText` regex vs `GraphToolbar.tsx:47` template literal — exact shape match.
   KEY ARGUMENT (reuse if challenged): a non-matching exclusion regex CANNOT silently pass —
   it stops filtering, count becomes 6, `toHaveCount(5)` fails loud. Only the over-filter
   direction was dangerous and the `^…$` anchor closes it.
4. Log audit instead of re-running e2e: sixth-proof `:267-271` (5 vs 6 + locator string
   containing the new regex), rename-proof `:302-305` (1 failed, `- /^Depth\d*$/`),
   old-form `:266` (16 passed → hole demonstrated), final `:268` (18 passed). Timestamps
   16:50–16:53 consistent.
5. Re-ran `npm run check` → exit 0 (`.tmp/review-r2-check.log`). Did not re-run `npm test`
   (no `src/` change) nor e2e (instructed not to).

## Deliberately NOT blocked on

- `PINNED_CENTRALS_SUMMARY` interpolated into the regex unescaped while the sibling map
  escapes. No metacharacters today; noted as NICE only.
- Exclusion filter never exercised in a pinned state → covered by argument in (3) + ticket N2.
- Tickets live in `_tickets/` while CLAUDE.md says `docs-internal/tickets/` — repo-wide
  convention drift from the `ticket` tool, not this change's fault. Called out, not blocked.

## Playwright semantics note (do not re-derive)

`$`-anchored regexes in `toHaveText` behave here; proven by the green runs, not by reading
the bundled playwright source (it is minified in `lib/`, no readable `injectedScript.js`).
