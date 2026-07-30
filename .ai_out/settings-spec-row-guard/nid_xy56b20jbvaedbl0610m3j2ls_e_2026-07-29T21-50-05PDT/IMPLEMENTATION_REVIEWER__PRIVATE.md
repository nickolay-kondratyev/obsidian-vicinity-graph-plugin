# Reviewer notes (private)

## Independently performed
- `git show 9edf6a1 --stat`: CLAUDE.md (1 line) + `src/view/settingsRowSpecCoverage.test.ts` (119 lines) + 4 `.ai_out/` files. No production change. Confirmed.
- NEGATIVE CHECK (re-done by me, not trusted from the saved file): removed the "Embeds out" row object from `src/view/settingsRows.ts` via a tab-exact python replace, ran `npx vitest run src/view/settingsRowSpecCoverage.test.ts` → 1 failed / 5 passed, message
  `globalDepths.embedDepthOut: no row in SETTINGS_GROUPS edits it (no user can reach this setting)`.
- ALSO ran the FULL suite with the row removed: `Test Files 1 failed | 91 passed (92)`, `Tests 1 failed | 1218 passed` — i.e. the NEW file is the ONLY thing that catches it, which independently re-confirms the ticket's "silent hole" premise.
- Restored: `git checkout -- src/view/settingsRows.ts`; `git status --porcelain` empty (only `.tmp/` which is ignored). Tree clean.
- Green run: `npm test` exit 0, 92 files / 1219 tests. `npm run check` exit 0 (src + e2e tsc).
- Outputs in `.tmp/neg-check.txt`, `.tmp/full-neg.txt`, `.tmp/full-green.txt`, `.tmp/check.txt`.

## Reasoning on the join
- `specLeafIdFor` arms split into DERIVED (`depth`, `sizing-number`, `sizing-metric`, `force-layout` — template from the typed field/metric) and SINGLETON (`node-preview`, `outline-depth`, `exclusion-enabled`, `exclusion-patterns`, `node-cap` — one hard-coded path each, but those kinds carry no field, so there is nothing to derive).
- Adding a FIELD to an existing family needs zero edit here. Adding a field that needs a NEW control kind is a compile error in this file (`unhandledRowControl` default) as well as both presenters. So it is a genuine compile-forced join, not a hand-maintained list.
- The residual hand-written part is the 3 path PREFIXES; test 2 pins them against the spec walk, and it fails loudly (not vacuously) if the spec re-nests. Verified by reasoning + the green test 2.
- Vacuity: if `SETTINGS_FIELD_LEAVES` were ever empty, test 1 passes vacuously but test 2 fails (every mapped id becomes stale). So test 5 adds nothing.

## Gap sweep (other ways a leaf could be unreachable)
- Row declared but not placed in a group: `EVERY_SETTINGS_ROW` derives from `SETTINGS_GROUPS[section].blocks`, so an orphan row array is invisible → the guard catches it. Closed.
- Group hidden from a surface: `openInPanel` is only `defaultOpen` (`GraphToolbar.tsx:75`); no group is panel-excluded. Not a hole.
- Control kind rendered by no presenter: compile-forced + `settingsRowParity.test.ts` source scan. Pre-existing coverage.
- Permanently-disabled row: only `disabledWhen: "exclusion-enabled"`, user-recoverable. Theoretical hole, not present.
