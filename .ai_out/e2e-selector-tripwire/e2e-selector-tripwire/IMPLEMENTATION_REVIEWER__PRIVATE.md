# IMPLEMENTATION_REVIEWER — PRIVATE working notes

State: review COMPLETE, verdict READY (0 BLOCKING, 2 SHOULD-FIX, 1 NICE-TO-HAVE).
Public review written to `IMPLEMENTATION_REVIEW__PUBLIC.md`. Tree left CLEAN.

## What I ran (all reverted)

1. `npm test` → exit 0 (75 files / 1003 tests, 1.08s). `npm run check` → exit 0.
   Logs in `.tmp/rev-test.log`, `.tmp/rev-check.log`. No `sanity_check.sh` in repo.
2. `.tmp/rev_analysis.py` — reimplemented the scan in Python independently:
   37 distinct non-absence asserted classes, 0 missing from render, 0 CSS-only,
   0 asserted-but-nowhere, 0 rendered-only-in-src/view-test-files.
3. **My own mutation** (different class + file than the implementer's):
   `src/view/FolderGroupNode.tsx:33` `vicinity-graph-group__label` → `__caption`.
   → guard exit=1, offender `e2e/vicinityGraph.e2e.ts:87`. Log `.tmp/rev-mutation.log`.
4. CSS-mask proof on the mutated tree: token absent from render, present in
   `graph-view.css:350` → a CSS-inclusive scan would be green. Deviation justified.
5. Comment-mask probe: prepended `// legacy: vicinity-graph-group__label …` to
   `NoteNode.tsx` while mutated → guard **green** (`.tmp/rev-comment.log`). Real gap.
6. Split absence assertion: rewrote `e2e/vicinityGraph.e2e.ts:178` into
   variable + later `toHaveCount(0)` → loud fail naming line 178 with the re-chain
   remediation (`.tmp/rev-split.log`). Implementer's claim verified.
7. `node -e` regex probe: `.vicinity-graph-node--${tier}` → `".vicinity-graph-node--"`
   (spurious token); `.vicinity-graph-${kind}` → no match (silent skip).

Revert commands used: `git checkout -- src/view/`, `git checkout -- e2e/vicinityGraph.e2e.ts`.
Final `git status --short` empty — CONFIRM THIS AGAIN if you re-run anything.

## Judgement calls a clone should not re-litigate

- The `.css` exclusion is a **correct** deviation from the ticket; the ticket wording
  would have produced a guard green on its own AC. Verified empirically, not argued.
- Wider e2e scope (all `e2e/**/*.ts`, not `*.e2e.ts`) is safe-direction; page objects
  are the obvious place selectors get centralized.
- Split-absence loud failure is acceptable, not annoying: the repo has 100% single-line
  `toHaveCount(0)` and the remedy is mechanical.
- Did NOT flag: minor file-listing duplication between `vaultTarget.test.ts` and
  `selectorGuard.test.ts` (different shapes, flat vs recursive — not knowledge dup).
- Did NOT flag: module-level `g` regex reuse — `matchAll` clones the regex, `lastIndex`
  never mutated; `ABSENCE_ASSERTION_PATTERN` is non-global so `.test()` is safe.
- Node 26 in env; `entry.parentPath` used by prior art too — fine.

## The two SHOULD-FIX (for a follow-up implementer)

S1: greedy `[\w-]+` on the e2e side yields `vicinity-graph-node--` for interpolated
    tails → spurious red. Drop tokens ending in `-`; add a matcher test.
S2: comments and `src/view/*.test.ts` count as "rendered". Exclude `*.test.ts(x)` from
    the render glob; document the comment limit in the "WHAT IT DOES NOT CATCH" block.
Neither blocks merge. Both are ~5-line changes.
