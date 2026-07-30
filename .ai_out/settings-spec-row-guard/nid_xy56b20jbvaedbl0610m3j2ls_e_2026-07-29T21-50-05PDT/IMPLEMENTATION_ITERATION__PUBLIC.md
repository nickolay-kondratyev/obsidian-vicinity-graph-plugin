# IMPLEMENTATION_ITERATION — nid_xy56b20jbvaedbl0610m3j2ls_e (settings row coverage guard)

Review verdict was READY. Both open items addressed below. Test-only change; still no production code touched.

## Per-item disposition

### 1. SHOULD-FIX — vacuity test counted the wrong side / name collided — **INCORPORATED**

`src/view/settingsRowSpecCoverage.test.ts`

The reviewer was right on both counts: the assertion counted `FIELDS_WITH_A_ROW` (the ROW side), so
it would have passed in the very case its name promised to catch (an empty leaf walk), and the same
test NAME meant something different in `settingsResetSpecCoverage.test.ts:65`.

Chose *fix* over the reviewer's alternative *delete*:

```ts
it("WHEN the field walk runs THEN it found fields to check (the guard is not vacuous)", () => {
	expect(SETTINGS_FIELD_LEAVES.length).toBeGreaterThan(0);
});
```

Both sibling suites (`settingsResetSpecCoverage.test.ts`, `settingsSpecBounds.test.ts:108`) carry an
explicit LEAF-side vacuity test under that name. Fixing the body makes name and meaning identical
across all three; deleting it would have left vacuity guarded only implicitly (via "no stale
mapping"), which is the same indirection the review objected to. One behavior, honest name.

### 2. NIT / my call — the empty `ROW_LESS_SETTINGS_FIELDS` allowlist — **INCORPORATED (dropped)**

Deleted the empty const and its two rot-guard tests (~30 lines that were structurally incapable of
failing). CLAUDE.md's PARETO / KISS / "no unused code" stance decides it while the const has zero
entries; scaffolding for a hypothetical entry is not worth two permanently-green tests.

The ticket's third acceptance criterion still holds **in substance**, because the sanctioned escape
hatch moved into the failure itself rather than disappearing. The coverage failure now reads:

```
globalDepths.embedDepthOut: no row in SETTINGS_GROUPS edits it (no user can reach this setting) —
give it a row in SETTINGS_GROUPS, or — if it is deliberately editable only by hand-editing
data.json — add an allowlist here keyed by leaf id with the reason as its value, plus the two
anti-rot tests that pattern carries (see BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE in
src/engine/settingsSpecBounds.test.ts). Never weaken this assertion.
```

So the first genuinely row-less leaf arrives with the allowlist-with-a-reason pattern named, located
and required at the exact moment a maintainer is looking at the failure — a better prompt than an
empty const they would have to notice. "Never weaken this assertion" closes the "just delete it"
path explicitly.

`CLAUDE.md`'s settings-tests clause was updated to match (it previously pointed at "that file's
allowlist", which no longer exists): it now says the failure states the only sanctioned escape hatch.

### 3. NIT — family→path-root knowledge in two view test files — **REJECTED**

Three string literals (`globalDepths.` / `globalView.` / `nodeExclusion.`) shared with
`sectionsOwning` in `settingsResetSpecCoverage.test.ts`. Both sites fail loudly and name the
offending leaf if the settings root is re-keyed, so drift cannot go silent. Extracting a shared
family↔root helper into `src/engine/testFixtures/` to save three literals is negative ROI and would
push view-shaped knowledge into an engine fixture. The reviewer scored this "low value today" too.

## Final state

`src/view/settingsRowSpecCoverage.test.ts` — 4 tests:
1. every declared settings field is edited by some declared row (the guard; failure names the leaf + how to fix);
2. no stale mapping (the hand-written dotted paths still exist in the spec);
3. the field walk is non-vacuous;
4. no two rows edit one field.

`CLAUDE.md` — one clause on the existing settings-tests bullet. No production change.

## Verification evidence

- **Negative check re-run.** Deleted the "Embeds out" row object from `src/view/settingsRows.ts` via
  python line surgery (the file is TAB-indented; a content assertion on the block ran first) →
  `npx vitest run src/view/settingsRowSpecCoverage.test.ts` exit 1, `1 failed | 3 passed`, failure
  names `globalDepths.embedDepthOut`. Full output saved to
  `negative-check-embeds-out-row-removed.txt` in this dir.
- **Restored.** `git checkout -- src/view/settingsRows.ts`; `git diff -- src/view/settingsRows.ts`
  is empty and the file no longer appears in `git status --porcelain`.
- **Gates green.** `npm test` exit 0 — 92 files / **1217** tests (1219 minus the two deleted
  rot-guards). `npm run check` exit 0 (src + e2e `tsc`). Outputs in `.tmp/npm-test.txt`,
  `.tmp/npm-check.txt`.

## Left for the top-level agent

No commit, no `change_log` entry, no ticket status change — per handoff instructions. Dirty paths:
`src/view/settingsRowSpecCoverage.test.ts`, `CLAUDE.md`, and this `.ai_out/` dir.
