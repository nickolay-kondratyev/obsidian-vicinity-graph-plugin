# IMPLEMENTATION — PRIVATE rehydration (03, pass 2, restart #2) — CONVERGED

All milestones done. See IMPLEMENTATION__PUBLIC.md for the human-facing record; this
file holds the exact commands/numbers for any future rehydration.

## Final state
- Working tree (UNCOMMITTED, top-level agent commits):
  M scripts/setup-dev-vault.sh, src/view/constants.ts, src/view/d3ForceRefinement.ts,
  docs-internal/CHANGELOG.md (new top entry)
  ?? src/view/{forceRectCollide.ts,forceRectCollide.test.ts,d3ForceStranding.test.ts}
  ?? docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md
- Predecessor authored steps 1–3+5; audited good, zero fixes needed. I added:
  CHANGELOG entry, e2e triage, visual acceptance, new e2e follow-up ticket, memories.

## Evidence ledger (all logs in .tmp/)
- RED: impl-red.log (mtime 03:24, pre-rewiring): 206.5235742967829 > 100.
- GREEN: impl2-test-final.log 703/703; impl2-check-final.log exit 0.
- GREEN gap number: impl2-green-measure.log → 32.843250838155804
  (trick: sed threshold to -99999, run file, sed back — vitest config is SILENT,
  console.log is swallowed; failing-assert printout is the reliable probe).
- e2e full: impl2-e2e.log → 21 pass / 2 fail / 7 skipped (serial abort).
- e2e baseline (stash): impl2-e2e-baseline.log → SAME 2 fail ⇒ pre-existing.
  Stash cmd used: `git stash push -u -m impl2-triage-baseline -- scripts/setup-dev-vault.sh
  src/view/constants.ts src/view/d3ForceRefinement.ts src/view/d3ForceStranding.test.ts
  src/view/forceRectCollide.ts src/view/forceRectCollide.test.ts docs-internal/CHANGELOG.md`
  then `git stash pop` (done — stash list empty).
- e2e baseline WITHOUT fixture notes (rm stranded-*, p/): impl2-e2e-baseline-nofixture.log
  → gamma still fails ⇒ fully pre-existing, not fixture-caused. Fixture restored via
  `npm run setup:dev-vault` (impl2-devvault2.log).
- e2e remainder vs my change: impl2-e2e-rest.log —
  `npm run test:e2e -- vicinityGraph.e2e.ts edgeRoutingEval.e2e.ts
   --grep-invert "singleton-folder|radial layout SKIPS"` → 24/24 pass
  (incl. PERF BUDGET + both node-click tests).
- Visual: .out/ticket-03-stranded-hub-after-fix.png via TEMP spec
  e2e/tmpStrandingVisual.e2e.ts (DELETED after run; gotcha: e2e is ESM —
  `__dirname` undefined, use `process.cwd()`; run-e2e cds to repo root).
  Eyeballed: enchiridion adjacent to ep box. Public-vault cross-check skipped —
  harness hard-wired to .dev-vault copy (obsidianHarness.ts DEV_VAULT_DIR).

## e2e verdicts
1. radial gating (edgeRoutingEval:171): pre-existing, tracked by
   _tickets/e2e-remove-layeredradial-layout-mode-references-left-by-force-layout-only-ticket.md
2. gamma breadcrumb (vicinityGraph:160): pre-existing (4/4 consistent), NEW ticket
   docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md. Lead: node
   likely mounts (11-count test passes) but breadcrumb element missing → suspect
   breadcrumbFolderOf refactor from the "node width floored" change, unconfirmed.

## Gotchas for successors
- Bash env prints ~30 lines of noise per command; always `> .tmp/... 2>&1`.
- vicinityGraph.e2e.ts is serial: one failure skips the rest ("did not run" ≠ pass).
- .dev-vault is gitignored: stashing code does NOT revert vault contents — good for
  code-vs-fixture isolation, but remember to rerun setup:dev-vault after deleting.
- Do NOT commit (top-level agent owns commits).
