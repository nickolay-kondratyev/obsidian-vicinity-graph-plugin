# PRIVATE memory — nid_xy56b20jbvaedbl0610m3j2ls_e (settings row coverage guard)

## Status: COMPLETE through IMPLEMENTATION_ITERATION. Tree dirty (not committed), branch untouched.

## Files (final)
- NEW: `src/view/settingsRowSpecCoverage.test.ts` — **4 tests** (was 6 before the iteration).
- EDIT (1 line): `CLAUDE.md` — settings-tests bullet names the guard; wording now says the FAILURE
  states the escape hatch (no allowlist exists to point at).
- No production change. Evidence: `negative-check-embeds-out-row-removed.txt` in this dir (refreshed).

## Key decisions (original, still standing)
- Walk `SETTINGS_FIELD_LEAVES`, not `EVERY_SETTINGS_SPEC_LEAF` — bounds-only leaves
  (`globalView.sizing.metricWeight`) are already excluded by the fixture; re-listing them here
  would duplicate that knowledge and pretend it is a UI decision.
- `specLeafIdFor(control)` is a `switch` closed by `unhandledRowControl` → a new control kind is a
  COMPILE error here too, so it cannot make its own leaf look row-less and misattribute the failure.
- Test 2 ("no stale mapping") pins the only hand-written part (three dotted path prefixes) and is
  also what makes test 1 non-vacuous if the spec were re-nested.
- Duplicate-mapping test kept: the `Set` in test 1 would swallow two rows on one field.

## IMPLEMENTATION_ITERATION decisions (review round)
1. **Reviewer item 1 (SHOULD-FIX) — INCORPORATED.** The vacuity test counted the ROW side, so it
   would have passed in the exact case it named, and it collided by NAME with a differently-meaning
   test in `settingsResetSpecCoverage.test.ts:65`. Rewrote the body to
   `expect(SETTINGS_FIELD_LEAVES.length).toBeGreaterThan(0)` and renamed to "WHEN the field walk
   runs …" — now identical in name AND meaning to both sibling suites' idiom
   (`settingsResetSpecCoverage.test.ts`, `settingsSpecBounds.test.ts:108`). Chose "fix" over the
   reviewer's alternative "delete" for CONSISTENCY: both siblings carry an explicit leaf-side
   vacuity test, and relying on test 2 as an implicit vacuity guard is exactly the indirection the
   reviewer objected to elsewhere.
2. **Reviewer item 2 (NIT, my call) — INCORPORATED (allowlist dropped).** Deleted the empty
   `ROW_LESS_SETTINGS_FIELDS` and its two rot-guards (~30 lines that could not fail).
   PARETO/KISS/no-unused-code wins when the const has zero entries. Ticket criterion 3 ("any
   intentionally row-less leaf is allowlisted with a written reason, not skipped") is honoured in
   SUBSTANCE by moving the instruction into the failure text (`HOW_TO_SATISFY_THIS_GUARD`): the
   failing maintainer is told to add the row, or add the allowlist WITH a reason AND its two
   anti-rot tests (pointing at `BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE`), and "never weaken this
   assertion". Escape hatch is sanctioned and discoverable at the moment of failure, which is
   strictly more useful than an empty const nobody reads.
3. **Reviewer item 3 (NIT, family→path-root duplication) — REJECTED.** Three string literals in two
   test files, both of which fail loudly and namingly on drift; extracting a shared helper into
   `src/engine/testFixtures/` to save three literals is negative ROI and would put view-shaped
   knowledge in an engine fixture. Left as-is deliberately.

## Verification (this round)
```bash
# negative check — python line surgery (settingsRows.ts is TAB-indented; Edit's tab-expanded
# Read view means copy-pasted old_string does NOT match)
python3  # delete lines 291-296 ("Embeds out" row object) with a content assertion first
npx vitest run src/view/settingsRowSpecCoverage.test.ts   # exit 1; 1 failed | 3 passed
  # names: globalDepths.embedDepthOut: no row in SETTINGS_GROUPS edits it … + the how-to-fix text
git checkout -- src/view/settingsRows.ts                  # git diff for that file: EMPTY
npm test      > .tmp/npm-test.txt    # exit 0 — 92 files / 1217 tests (1219 - 2 removed rot-guards)
npm run check > .tmp/npm-check.txt   # exit 0 (src + e2e tsc)
```

## Not done (per instructions)
No commit, no change_log entry, no ticket edit — top-level agent owns those.
