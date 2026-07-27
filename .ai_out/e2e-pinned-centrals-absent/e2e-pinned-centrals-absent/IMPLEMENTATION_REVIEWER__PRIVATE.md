# PRIVATE reviewer memory — ticket `nid_d9j4o9ecp93g5zhury5m1fb43_e`

## Verdict: CONVERGED (round 1). No blocking issues. Commit `e77f700`.

## What I verified MYSELF (not taken on faith)

- `git diff main --stat -- src/ e2e/` → only the 2 e2e files. `src/` untouched → mutation
  genuinely reverted.
- `npm test` → 75 files / 1010 tests pass, exit 0 (`.tmp/rev-vitest.log`).
- `npm run check` → exit 0 (`.tmp/rev-check.log`).
- `npm run test:e2e -- settingsUxVisual.e2e.ts` → **17 passed (3.4s), exit 0**
  (`.tmp/rev-e2e.log`). New test is #3, 5ms.
- Corroborated the implementer's mutation log at `.tmp/e2e-mutation.log:268-295`
  ("Expected: 0 / Received: 1", 1 failed). I did NOT re-run the mutation myself —
  I am read-only for `src/`.

## Why the vacuous-pass worry is NOT real here

`setOpen(toolbar(), true)` does `locator.first().evaluate(...)`, which auto-waits for
`.vicinity-graph-toolbar` to be ATTACHED and THROWS if it never appears. `GraphToolbar`
renders `__body` + its unconditional disclosures in the same React pass as the toolbar
`<details>`, so "toolbar exists" ⇒ "panel rendered". A never-rendered panel therefore
fails at the GIVEN, not silently at `toHaveCount(0)`. Good enough; explicitly asserting
a non-zero summary count would just duplicate the exhaustiveness test.

## Mutation-space analysis (which regressions each spec catches)

| mutation | new absence test | exhaustiveness test |
|---|---|---|
| guard dropped, renders "Pinned centrals (0)" | RED (verified) | green (the blind spot) |
| guard dropped, count label removed | green | RED (count 6 + hasNotText miss) |
| disclosure moved to a NESTED level, unconditional | green | green ← residual gap |

The residual nested-level gap is a hypothetical refactor, out of ticket scope; both
PRESENCE specs use unscoped locators so they'd still work. Noted, not filed.

## Real (non-blocking) finding worth remembering

`prepareVaultCopy` deletes `data.json` but NOT `.obsidian/plugins/vicinity-graph/doc-data/`,
which is where PINS live. `.dev-vault` is gitignored and human-QA'd; a human who pins a
central during manual QA leaves a `doc-data/<docid>.json` that the throwaway copy inherits.
The new absence test is the FIRST spec to depend on the seeded vault being pin-free, so it
would go spuriously RED on such a machine. Currently `.dev-vault/.obsidian/plugins/
vicinity-graph/doc-data/` is empty, so no failure today. Failure mode is a loud RED, never a
false green → suggestion + ticket, not a blocker. Fix: `fs.rmSync(path.join(VAULT_COPY_DIR,
".obsidian","plugins",PLUGIN_ID,"doc-data"), {recursive:true, force:true})` next to the
existing data.json wipe, sharing its WHY.

## Nits deliberately NOT raised

- 130-col assertion line: forced by `selectorGuard`'s line-scoped exemption, repo has no
  prettier. Correct call by the implementer.
- Two constants (`PINNED_CENTRALS_SUMMARY` bare vs `_PATTERN`): not duplication — the
  pattern is DERIVED from the bare one, and the two have genuinely different jobs
  (find-it vs it-and-nothing-else). Docs say so accurately.
