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
