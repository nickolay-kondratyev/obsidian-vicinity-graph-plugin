# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE memory

Ticket `nid_6mack3e3ql9qtaxf1edezjpfs_e`. Branch `e2e-vault-reseed-doc-data`.

## Goal
`ObsidianHarness.prepareVaultCopy` must delete `.obsidian/plugins/vicinity-graph/doc-data/`
(per-doc persistence = PINS) from the throwaway vault copy, alongside the existing
`data.json` deletion, so a pin made during manual `.dev-vault` QA cannot leak into e2e.

## Plan
1. [x] Read EXPLORATION_PUBLIC.md; re-verify line numbers.
2. [x] Edit `e2e/obsidianHarness.ts` `prepareVaultCopy` — add a second `fs.rmSync`
       literally rooted at `VAULT_COPY_DIR`; extend the WHY comment to cover pins.
3. [x] Extend the `prepareVaultCopy` doc comment (mentions "plugin data.json" only).
4. [x] Testing decision (see PUBLIC.md): no new automated test; static guard +
       behavioral manual proof. File follow-up ticket for shared `doc-data` constant.
5. [x] `npm test`, `npm run check` → `.tmp/`.
6. [x] Behavioral proof: scratch `doc-data/<x>.json` in a copy of `.dev-vault`, run
       the real copy logic, confirm absence in `.tmp/e2e/vault`.
7. [x] `npm run test:e2e -- settingsUxVisual.e2e.ts` attempt (expected: no real Obsidian here).
8. [x] Commit.

## Key constraints (do not violate)
- `e2e/vaultTarget.test.ts` "e2e harness destructive calls" static scan: every mutating
  `fs.*` call's destination arg must be TEXTUALLY rooted at `VAULT_COPY_DIR` /
  `SANDBOX_CONFIG_DIR` / `OUT_DIR` (after peeling `path.join|dirname|resolve(`).
  Sync `node:fs` only; import form exactly `import * as fs from "node:fs";`.
- `prepareVaultCopy` is `private static` → not behaviorally testable without widening API.
- `e2e/` imports from `src/` are TYPE-ONLY today (runtime import would load the barrel in
  the node-side process). Hence `"doc-data"` is hardcoded in the harness, not imported.

## Iteration round (after IMPLEMENTATION_REVIEW__PUBLIC.md — 0 MUST-FIX, 2 SHOULD-FIX)
9.  [x] SHOULD-FIX 1 ACCEPTED: added `e2e/vaultCopyReseed.test.ts` — read-only source scan
        cross-checking `src/main.ts` `docDataDirPath()`'s `doc-data` literal against the
        harness wipe. Guard-safe (`readFileSync` is allowlisted), verified to FAIL when
        either side is perturbed. Own file (SRP) rather than a 3rd describe in
        `vaultTarget.test.ts`, which declares itself the vault-SAFETY guard.
        NOTE: the earlier "no automated test possible" claim was overstated — it only held
        for BEHAVIORAL tests; a read-only source scan was always available.
10. [x] SHOULD-FIX 2: ticket `nid_0jzq3ev878kjd0zhn3zxyje8q_e` filed + linked (workspace.json
        leak). NO code change, per reviewer's out-of-scope call.
11. [x] Note added to `nid_7fq9y51mbucmduzf9z31hmwmq_e`: delete the new guard file when the
        shared constant lands (the guard's WHY comment says the same, both ends linked).
12. [x] `npm test` 76 files / 1011 tests PASS; `npm run check` PASS. Committed.

## State at exit
Done; see IMPLEMENTATION_ITERATION__PUBLIC.md (this round) and
IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md (original round; its "Testing decision — no new
automated test" section is SUPERSEDED by the guard added in step 9).
Left for TOP_LEVEL_AGENT: change_log entry, closing `nid_6mack3e3ql9qtaxf1edezjpfs_e`.
