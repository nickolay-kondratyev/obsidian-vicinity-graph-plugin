# PRIVATE memory — nid_xy56b20jbvaedbl0610m3j2ls_e (settings row coverage guard)

## Status: COMPLETE. Tree left dirty (not committed), branch untouched.

## Plan (executed as written)
1. Read ticket `_tickets/settings-guard-that-every-settingsspec-leaf-has-a-declared-row-*.md`, the spec-leaf fixture, `settingsRows.ts`, `settingsRowParity.test.ts`, `settingsSpecBounds.test.ts`, `settingsResetSpecCoverage.test.ts` (closest sibling pattern).
2. Write `src/view/settingsRowSpecCoverage.test.ts`.
3. Negative check by deleting the "Embeds out" row, then restore via `git checkout --`.
4. `npm test` + `npm run check`.

## Files
- NEW: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/settingsRowSpecCoverage.test.ts`
- EDIT (1 line): `CLAUDE.md` — settings-rows bullet now names the new guard + its allowlist.
- No production change.
- Evidence: `negative-check-embeds-out-row-removed.txt` in this dir.

## Key decisions
- **Walk `SETTINGS_FIELD_LEAVES`, not `EVERY_SETTINGS_SPEC_LEAF`.** The fixture already
  excludes `globalView.sizing.metricWeight` as `BOUNDS_ONLY_SPEC_LEAF_IDS` (bounds for a
  sibling shape, no settings field at all). Re-listing it in a row-less allowlist would
  duplicate that knowledge (DRY) and pretend it is a UI decision. Documented in the file header.
- **`specLeafIdFor(control)` is a `switch` closed by `unhandledRowControl(control)`**, not a
  table: a new control kind is then a COMPILE error here too, so it cannot make its own leaf
  look row-less and misattribute the failure. This is the join between the row model's typed
  per-family field refs and the spec's dotted paths.
- The dotted paths are the only hand-written part → test 2 ("no stale mapping") asserts every
  mapped id still exists as a declared leaf, which also stops test 1 from passing vacuously if
  the spec were re-nested.
- **Allowlist `ROW_LESS_SETTINGS_FIELDS` is EMPTY today** — every declared field has a row
  (verified: 3 depths, 5 metrics, 3 sizing numbers, node-preview, outline-depth, 7 force-layout,
  2 exclusion, node-cap). Anti-rot: two tests fail if an entry names a non-existent leaf or a
  leaf that has since gained a row.
- Added a duplicate-mapping test (two rows editing one field) because the coverage test matches
  against a `Set`, which would swallow that.

## Commands
```bash
npx vitest run src/view/settingsRowSpecCoverage.test.ts   # 6 passed
npm test    > .tmp/npm-test.txt   # 92 files / 1219 tests passed, exit 0
npm run check > .tmp/npm-check.txt # exit 0
```

## Negative-check mechanics (repeat if needed)
`settingsRows.ts` is TAB-indented; the `Edit` tool's Read view expands tabs, so copy-pasted
`old_string` did NOT match. Used python line surgery instead (deleted lines 291-296, the
"Embeds out" row object) with an assertion on the block content, then `git checkout --` to restore.
Result: `globalDepths.embedDepthOut: no row in SETTINGS_GROUPS edits it (no user can reach this setting)`.

## Not done (per instructions)
No commit, no change_log entry, no ticket edit.
