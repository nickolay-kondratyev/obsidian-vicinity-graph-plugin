# Settings: every SETTINGS_SPEC leaf must have a declared row — DONE

Ticket `nid_xy56b20jbvaedbl0610m3j2ls_e`. Test-only change; **no production behavior change**.

## What changed

- **NEW** `src/view/settingsRowSpecCoverage.test.ts` (6 BDD tests) — walks the declared
  settings fields and asserts each is edited by some row in `SETTINGS_GROUPS`.
- **EDIT** `CLAUDE.md` — one clause on the existing settings-rows bullet naming the new guard
  and its allowlist (stable knowledge, so the next person adding a field knows the step is loud now).

## Decisions a reviewer should know

1. **The join is a compile-forced `switch`, not a table.** `specLeafIdFor(control)` maps a row
   control to its dotted spec-leaf id and is closed by `unhandledRowControl(control)`. A NEW
   control kind is therefore a compile error in this file as well — without that, a new kind
   would silently map to nothing, make its own leaf look row-less, and blame the wrong thing.
2. **The hand-written dotted paths are themselves guarded.** A second test asserts every mapped
   id still exists as a declared spec leaf. This is what stops the coverage test from passing
   vacuously (matching nothing) if the spec tree is ever re-nested.
3. **The walk is `SETTINGS_FIELD_LEAVES`, not `EVERY_SETTINGS_SPEC_LEAF`.** That derived list
   (same fixture) already excludes `globalView.sizing.metricWeight`, which is bounds-only for a
   sibling shape and is no settings field at all — re-listing it in a row-less allowlist would
   duplicate an existing, documented exception. Stated in the file header.
4. **The allowlist is EMPTY today** (`ROW_LESS_SETTINGS_FIELDS`): every declared field is
   reachable on both surfaces, so nothing needed a reason string. The pattern and the required
   reason-per-entry are documented in place, mirroring `BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE`.
   **Anti-rot:** two further tests fail if an entry names a leaf that no longer exists, or a leaf
   that has since gained a row.
5. Extra test: no two rows may map to the same field — the coverage check matches against a
   `Set`, which would otherwise swallow a duplicate control on one setting.

## Acceptance-criteria evidence

1. **The guard can actually FAIL — performed, then reverted.** The "Embeds out" row object was
   deleted from `SETTINGS_GROUPS` and the suite run. Output (saved verbatim in
   `negative-check-embeds-out-row-removed.txt` beside this file):

   ```
   AssertionError: expected [ Array(1) ] to deeply equal []
   +   "globalDepths.embedDepthOut: no row in SETTINGS_GROUPS edits it (no user can reach this setting)",
    Tests  1 failed | 5 passed (6)
   ```

   The row was then restored with `git checkout -- src/view/settingsRows.ts`; `git status`
   confirms `settingsRows.ts` is unmodified in the delivered tree.
2. **Green with the row present:** `npm test` → exit 0, **92 files / 1219 tests passed**;
   `npm run check` (src + e2e `tsc -noEmit`) → exit 0.
3. **No silent skips:** the only exclusion is the pre-existing, documented bounds-only leaf; the
   row-less allowlist exists, is empty, and is itself guarded against rot.

## Handoff

Tree left dirty on the current branch as instructed — no commit, no `change_log` entry, no ticket
edit. Untracked/modified: `src/view/settingsRowSpecCoverage.test.ts` (new), `CLAUDE.md` (1 line),
plus this `.ai_out/` directory.
