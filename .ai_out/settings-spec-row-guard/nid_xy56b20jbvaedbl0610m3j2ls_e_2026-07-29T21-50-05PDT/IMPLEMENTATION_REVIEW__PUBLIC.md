# IMPLEMENTATION REVIEW — nid_xy56b20jbvaedbl0610m3j2ls_e (commit 9edf6a1)

## Summary

Test-only change closing the last silent step in the settings model: a `SETTINGS_SPEC` leaf
that no row in `SETTINGS_GROUPS` edits now FAILS `npm test` naming the leaf.
New file `src/view/settingsRowSpecCoverage.test.ts` (6 tests) + one clause on the
`**Settings tests**` bullet in `CLAUDE.md`. No production change — verified from
`git show 9edf6a1 --stat`.

**The guard works, and it is the right shape.** No blocking issues.

## Verification I performed independently (not taken from the implementer's saved output)

1. **Negative check re-run.** Removed the "Embeds out" row object from
   `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/settingsRows.ts`
   (tab-exact replace) → the suite fails with
   `globalDepths.embedDepthOut: no row in SETTINGS_GROUPS edits it (no user can reach this setting)`.
2. **Stronger than the acceptance criterion asked:** I ran the FULL suite with the row removed —
   `Test Files 1 failed | 91 passed (92)`, `Tests 1 failed | 1218 passed (1219)`. The new file is
   the ONLY thing in the repo that catches it, which re-confirms the ticket's premise from scratch.
3. **Restored** with `git checkout -- src/view/settingsRows.ts`; `git status --porcelain` is empty.
4. **Green:** `npm test` exit 0 (92 files / 1219 tests), `npm run check` exit 0 (src + e2e `tsc`).

## 🚨 BLOCKING

None.

## ⚠️ SHOULD-FIX

### 1. Test 5 is redundant and its name does not describe what it asserts
`src/view/settingsRowSpecCoverage.test.ts:107-109`

```ts
it("WHEN the walk runs THEN it found fields to check (the guard is not vacuous)", () => {
	expect(FIELDS_WITH_A_ROW.size).toBeGreaterThan(Object.keys(ROW_LESS_SETTINGS_FIELDS).length);
});
```

- The vacuity risk for test 1 is `SETTINGS_FIELD_LEAVES` going empty. This assertion counts the
  ROW side, so it would still pass in exactly that case. The name promises a guarantee the body
  does not make — the "behavior must match naming" rule in CLAUDE.md.
- It is also already covered: if the leaf walk emptied, **test 2** (`no stale mapping`) fails,
  because every mapped id becomes stale. So the real vacuity guard exists one test above.
- The identical test NAME already exists in `src/view/settingsResetSpecCoverage.test.ts:65`, where
  it *does* assert `SETTINGS_FIELD_LEAVES.length > …`. Two tests with one name and two different
  meanings is the kind of drift this settings model has been systematically removing.

**Fix:** delete it, or make it say what it means: `expect(SETTINGS_FIELD_LEAVES.length).toBeGreaterThan(0)`.

## 💡 Suggestions / NITs

### 2. The empty allowlist plus its two rot-guards is scaffolding that cannot fail today
`src/view/settingsRowSpecCoverage.test.ts:73`, tests at `:97` and `:102`.

`ROW_LESS_SETTINGS_FIELDS` is `{}`, so both rot-guards iterate nothing and are structurally
incapable of failing — ~30 lines that assert `[] === []`. The ticket asked for the
allowlist-with-a-reason pattern *"if leaves that are intentionally row-less exist today"*; none do,
and the implementer says so explicitly.

I am NOT calling this blocking: the pattern mirrors `BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE`, the
reason-per-entry contract is documented in place, and the guards start earning their keep the
moment an entry appears. But per KISS/YAGNI the honest minimum is the empty const with its
docblock and ONE combined rot test (or none until an entry exists). Reviewer's call; I'd trim to
tests 1, 2 and 6 (three tests, ~40 lines including prose) and let the allowlist arrive with its
first entry.

### 3. Small duplication: the family→path-root knowledge now lives in two view test files
`specLeafIdFor` (`settingsRowSpecCoverage.test.ts:38-61`) hard-codes the roots
`globalDepths.` / `globalView.` / `nodeExclusion.`; `sectionsOwning`
(`src/view/settingsResetSpecCoverage.test.ts:52-63`) decodes the same three roots in the opposite
direction off `leaf.path[0]`. If the settings root is ever re-keyed, both edit. A tiny shared
helper in `src/engine/testFixtures/settingsSpecLeaves.ts` (family name ↔ path root) would put it
in one place. Low value today — three literals, both sites fail loudly on drift.

### 4. Answers to the specific questions asked of me

- **Is the join real or a hand-maintained list in disguise?** Real. The arms split into DERIVED
  (`depth`, `sizing-number`, `sizing-metric`, `force-layout` — templated from the typed
  `control.field` / `control.metric`, so a NEW FIELD in an existing family needs zero edit here)
  and SINGLETON (`node-preview`, `outline-depth`, `exclusion-enabled`, `exclusion-patterns`,
  `node-cap` — those kinds carry no field, so there is nothing to derive). A field that needs a NEW
  control kind is a compile error in this file via `unhandledRowControl`, on top of both presenters.
  The only hand-written residue is three path prefixes, and test 2 pins them against the spec walk.
  This is the right design; the obvious cheaper alternative (match on `leaf.path[1]`, the way
  `sectionsOwning` does) would be COARSER and would let a new leaf under `sizing`/`forceLayout`
  slip through. Good call by the implementer.
- **Other ways a leaf can be silently unreachable** (all swept, none a defect in this change):
  - *Row declared but never placed in a group* — closed by construction: `EVERY_SETTINGS_ROW`
    derives from `SETTINGS_GROUPS[section].blocks`, so an orphan row array is invisible to it and
    the leaf reports as unreachable.
  - *Group hidden from a surface* — not a hole: `openInPanel` is only `defaultOpen`
    (`src/view/GraphToolbar.tsx:75`); no group is excluded from either surface.
  - *Control kind no presenter renders* — pre-existing coverage (compile-forced switch +
    `src/view/settingsRowParity.test.ts` source scan).
  - *Leaf reachable only through a permanently disabled row* — genuinely unguarded, but the only
    `disabledWhen` today is `exclusion-patterns` gated on `exclusion-enabled`, which the user can
    turn on. Out of ticket scope; not worth a ticket at one occurrence.
- **Test quality / budget.** BDD WHEN/THEN naming is correct throughout, one behavior per test,
  failures name the offending leaf rather than asserting a count. Test 6 (no two rows edit one
  field) is a real invariant that the `Set` in test 1 would otherwise swallow — justified. Tests 3,
  4 and 5 are the ones I would not have written (see items 1 and 2). The ticket's "~10 lines"
  budget is exceeded mainly by prose, and the prose density matches the surrounding settings
  suites, so I do not count that against it.

## Documentation

The `CLAUDE.md` clause is accurate, succinct and attached to the existing settings-tests bullet
rather than adding a new one — correct placement. No further doc updates needed.
The ticket file
`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/_tickets/settings-guard-that-every-settingsspec-leaf-has-a-declared-row-the-last-silent-hand-maintained-step.md`
is still `status: open` and there is no `change_log` entry — deliberate per the implementer's
handoff instructions, so this is on the orchestrator, not a review defect.

## Verdict

**READY.** All three acceptance criteria independently verified. Item 1 (SHOULD-FIX) is a
one-line change to a test that is currently misnamed and redundant; item 2 is a trim I recommend
but will not hold the change for.
