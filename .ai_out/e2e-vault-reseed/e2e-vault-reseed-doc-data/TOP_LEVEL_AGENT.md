# TOP_LEVEL_AGENT — e2e vault reseed wipes doc-data/

Ticket: `nid_6mack3e3ql9qtaxf1edezjpfs_e`
Branch: `e2e-vault-reseed-doc-data` (from `main` @ e98fa71)
Feature dir: `.ai_out/e2e-vault-reseed/e2e-vault-reseed-doc-data/`

Goal: `ObsidianHarness.prepareVaultCopy` must remove the per-doc persistence dir
(pins) alongside `data.json`, so a fresh e2e launch always starts with zero pins.

## Flow (straightforward-flow) — CONVERGED
- [x] EXPLORATION — Explore agent ran read-only and could not write files; TOP_LEVEL_AGENT
      transcribed its findings into `EXPLORATION_PUBLIC.md` (commit e9764e4).
- [x] IMPLEMENTATION_WITH_SELF_PLAN — f475d68. `doc-data/` wipe + WHY comments + class doc.
      Chose to hardcode `"doc-data"` in the harness rather than take a new runtime
      `e2e/` → `src/` import; filed `nid_7fq9y51mbucmduzf9z31hmwmq_e` for the shared constant.
- [x] IMPLEMENTATION_REVIEW — READY, 0 MUST-FIX, 2 SHOULD-FIX.
- [x] IMPLEMENTATION_ITERATION (1 round) — 033e864.
      - SHOULD-FIX 1 ACCEPTED: new `e2e/vaultCopyReseed.test.ts` drift guard.
      - SHOULD-FIX 2 ticketed only (out of scope): `nid_0jzq3ev878kjd0zhn3zxyje8q_e`.
- [x] IMPLEMENTATION_REVIEW round 2 — READY, 0 MUST-FIX. Both roles signalled readiness.
- [x] change_log `kibtyj6wavh6yzkr9osockqqr` + ticket closed + merge to main (--no-ff).

## Decisions by TOP_LEVEL_AGENT
- Round-2 review's single optional NIT (whitespace-normalize the harness assertion so a
  one-arg-per-line reflow can't false-fail it) was **not** applied: reviewer rated it low
  risk, the repo has no formatter, and it would be pure churn. Failure mode is loud.

## Known gap (carried forward, stated in ticket + change_log)
The acceptance criteria's manual repro (pin in `.dev-vault`, re-run the e2e spec) was not
achievable: the spec's main note has no stable `id:` to key a planted pin to, and
`.dev-vault`'s `doc-data/` was empty. The e2e run (17/17 green) therefore proves no
regression, not the repair; the repair is proven by a scratch-copy negative control.
