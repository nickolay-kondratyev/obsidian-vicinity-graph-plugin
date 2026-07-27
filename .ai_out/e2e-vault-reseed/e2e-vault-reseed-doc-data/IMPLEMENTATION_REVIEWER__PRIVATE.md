# IMPLEMENTATION_REVIEWER — PRIVATE notes

## Independently verified
- `npm test` → 75 files / 1010 tests PASS (`.tmp/rev-test.log`, exit 0).
- `npm run check` (tsc strict + `check:e2e`) → PASS (`.tmp/rev-check.log`, exit 0).
- `.tmp/e2e-attempt.log` really contains `17 passed` for `settingsUxVisual.e2e.ts` — the
  implementer's e2e claim is truthful, and their own caveat (`.dev-vault/…/doc-data/` is
  EMPTY today → the run proves no regression, not the repair) is confirmed:
  `ls -la .dev-vault/.obsidian/plugins/vicinity-graph/doc-data` shows an empty dir.
- Authoritative dir name: `src/main.ts:124-128` `docDataDirPath()` returns
  `${pluginDir}/doc-data`. `doc-data` in the harness is correct.
- Plugin's ONLY persisted state = `data.json` (via `saveData`, `PluginDataStore.ts:70`) +
  `doc-data/<docid>.json` (`DocDataStore`). No third slice. Completeness OK.
- `git status` clean; `.dev-vault` untouched and is NOT git-tracked (`git ls-files .dev-vault`
  → empty), i.e. every byte of `.obsidian/` in it is human-QA state.
- Guard (`e2e/vaultTarget.test.ts:155-209`) is byte-identical to main — no exclusion
  broadened, no allowlist touched. The new `rmSync` destination is
  `path.join(VAULT_COPY_DIR, ...)`, which the scan's wrapper-peel + `SAFE_WRITE_ROOTS`
  accepts on merit, not by exemption.

## Testing argument — where it holds and where it is overstated
Holds: a NEW `e2e/*.test.ts` doing a behavioral round-trip would need scratch-vault writes
not rooted at the three safe constants → offender → would force weakening the scan. Correct.
Holds: an exported `STALE_PLUGIN_STATE_RELATIVE_PATHS` + "contains doc-data" assert is a
tautology. Correct, and refusing to write it is the right call per CLAUDE.md.

Overstated: those two are not the only options. `readFileSync` is on `READ_ONLY_FS_MEMBERS`,
so a pure SOURCE-scan consistency test is fully guard-safe and non-tautological — it fails if
`src/main.ts` renames the dir without the harness following, and it fails if the `rmSync` line
is deleted. That is exactly the regression the follow-up ticket describes. Repo precedent for
source-scan tests is strong (importGuard, the destructive-call scan itself).
Also note a behavioral test COULD legally live inside `vaultTarget.test.ts` (the one file the
scan excludes by `path.basename(import.meta.url)`) — but it would need bracket access to a
private static and would nuke `.tmp/e2e/vault` during `npm test`; I do not recommend it.

## Out of scope, but real
`.dev-vault/.obsidian/workspace.json` (5.8 KB, human-QA layout, untracked) is copied verbatim
and never wiped. Not this ticket, and the harness detaches stray right-split leaves
(`obsidianHarness.ts:289-302`), so no current assertion depends on it. Worth a ticket.
RESOLVED round 2: ticket `nid_0jzq3ev878kjd0zhn3zxyje8q_e` filed, no code change. Right call.

---

# ROUND 2 (commit `033e864`) — fresh reviewer, narrow confirmation pass

## Independently verified (mine, this round)
- `npm test` → **76 files / 1011 tests PASS**, exit 0 (`.tmp/rev2-test.log`). Implementer's
  numbers are truthful.
- `npm run check` → PASS, exit 0 (`.tmp/rev2-check.log`). `git status` clean after.
- No `sanity_check.sh` in repo — n/a.

## Guard genuineness — method + results
Did NOT perturb the tree (read-only role). Replayed the guard logic
(`/\$\{pluginDir\}\/([\w-]+)`/` → `toContain('PLUGIN_ID, "<name>"')`) over in-memory mutated
source copies via a node one-liner:
- A `src/main.ts` `doc-data`→`per-doc` (harness untouched) → **FAIL** ✔
- B harness `doc-data` `rmSync` statement deleted → **FAIL** ✔
- C `docDataDirPath()` → `[pluginDir,"doc-data"].join("/")` → **THROWS** w/ guidance ✔ (loud,
  not a silent `undefined` degrade — the implementer's deviation #2 from my predecessor's
  snippet is the better design)
- E harness COMMENT mentions of `` `doc-data/` `` reworded → PASS ✔ (not comment-brittle)
- D harness call reflowed one-arg-per-line → FAIL (false positive). Low real risk: repo has
  NO prettier config / eslint / format script, line is 87 chars. Suggestion only.
- F `rmSync`→non-destructive call, `path.join` kept → PASS. Tolerable: the test NAME says
  "names the same dir", not "wipes"; behavior matches naming. B covers the realistic case.

Structural checks that make the regex tighter than it looks: `${pluginDir}/` occurs **exactly
once** in `src/main.ts` (no first-match ambiguity); `[\w-]+` cannot swallow `.`, so a sibling
`${pluginDir}/data.json` would not be mis-matched.

## Guard integrity
`e2e/vaultTarget.test.ts` untouched in `033e864`. `scannedFiles` excludes only
`path.basename(import.meta.url)`, so `vaultCopyReseed.test.ts` IS scanned; it uses
`readFileSync` only (on `READ_ONLY_FS_MEMBERS`) and its `import * as fs from "node:fs";`
matches `NAMESPACE_FS_IMPORT`. Accepted on merit, nothing widened. Implementer's "strictly
better than a 3rd describe" claim checks out — I agree and prefer their placement to my
predecessor's snippet.

## Bookkeeping
`nid_7fq9y51mbucmduzf9z31hmwmq_e` has the reciprocal "DELETE that file" note — verified both
ends linked. `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` marked SUPERSEDED rather than
rewritten: honest, keeps the record of the earlier wrong conclusion.
`REPO_ROOT` one-liner duplication = existing repo pattern in 5 e2e files, not a new DRY debt.

## Verdict round 2
READY, 0 MUST-FIX, 0 IMPORTANT, 1 optional suggestion (whitespace-insensitive harness read).
See `IMPLEMENTATION_REVIEW_ROUND2__PUBLIC.md`.
