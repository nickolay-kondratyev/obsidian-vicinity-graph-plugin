# IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC — ticket `nid_d9j4o9ecp93g5zhury5m1fb43_e`

Branch `e2e-pinned-centrals-absent`. Closes the coverage gap: nothing asserted the
conditional "Pinned centrals (n)" disclosure is ABSENT when nothing is pinned.

## What changed (2 files, e2e only — `src/` untouched)

### `e2e/settingsBaseline.ts`

- NEW export `PINNED_CENTRALS_SUMMARY_PATTERN = new RegExp(`^${PINNED_CENTRALS_SUMMARY} \\(\\d+\\)$`)`.
  The anchored count-regex literal previously lived inline in the exhaustiveness
  filter; it is now needed by the new absence assertion too, so it is extracted
  once rather than duplicated (the ticket's explicit DRY ask).
- `PINNED_CENTRALS_SUMMARY` doc comment rewritten: it no longer describes "how to
  build the anchored regex" (that knowledge moved into the new constant's own doc)
  and instead points readers at `PINNED_CENTRALS_SUMMARY_PATTERN`. The bare
  constant survives unchanged and is still used by the two PRESENCE locators in
  `controlsRestart.e2e.ts` / `pinnedCentralScenario.e2e.ts`.
- `CONTROLS_PANEL_DISCLOSURES` doc updated: the "Pinned centrals" exclusion now
  says it is filtered by the PATTERN and separately asserted absent.

### `e2e/settingsUxVisual.e2e.ts`

- Extracted `TOP_LEVEL_PANEL_SUMMARY_SELECTOR` (the `body > disclosure > summary`
  direct-child chain) with the "`>` twice, deliberately" rationale moved onto it;
  used by BOTH the exhaustiveness locator and the new absence assertion, so the two
  cannot drift into scoping different things.
- `topLevelPanelSummaries()` now filters with `PINNED_CENTRALS_SUMMARY_PATTERN`.
  **Semantics identical** — same anchored regex, same `hasNotText`, same selector.
- NEW test, sibling of the exhaustiveness test:
  `panel: WHEN no central is pinned THEN the panel has no Pinned centrals disclosure`
  — a single chained one-line `await expect(page.locator(TOP_LEVEL_PANEL_SUMMARY_SELECTOR).filter({ hasText: PINNED_CENTRALS_SUMMARY_PATTERN })).toHaveCount(0);`
  (one-line form kept per `selectorGuard.test.ts`'s `ABSENCE_ASSERTION_PATTERN`;
  as it happens the line names no `.vicinity-graph-*` literal at all, so the guard
  is doubly satisfied).
- A WHY block above it records that this is precisely the hole the by-name filter
  opens, and that placement matters (serial file, fixture must not have pinned yet).

Nothing was relaxed, weakened or deleted. No `change_log` entry (owned by
TOP_LEVEL_AGENT). Not merged to main.

## Test evidence (all commands run from repo root)

### 1. `npm test`

```
 Test Files  75 passed (75)
      Tests  1010 passed (1010)
```
Exit 0. Includes `selectorGuard.test.ts` and `settingsBaseline.test.ts`.

### 2. `npm run check`

Exit 0 (`tsc -noEmit` for `src/`, then `tsc -noEmit -p e2e/tsconfig.json`). No output.

### 3. `npm run test:e2e -- settingsUxVisual.e2e.ts` (real Obsidian, auto-downloaded, headless)

```
  ✓   2 e2e/settingsUxVisual.e2e.ts:106:1 › panel: WHEN the controls panel renders THEN its top-level disclosures are exactly the listed ones, in order (18ms)
  ✓   3 e2e/settingsUxVisual.e2e.ts:142:1 › panel: WHEN no central is pinned THEN the panel has no Pinned centrals disclosure (7ms)
  17 passed (3.5s)
```
Exit 0. (Log: `.tmp/e2e-baseline.log`.)

Regression check on the PRESENCE specs that share the constant:
`npm run test:e2e -- pinnedCentralScenario.e2e.ts controlsRestart.e2e.ts` → `3 passed (22.9s)`, exit 0.

### 4. MUTATION EXPERIMENT — **actually ran**, on the real-Obsidian gate

Mutation applied to `src/view/GraphToolbar.tsx`: `{pinned.length > 0 && (` → `{true && (`
(disclosure renders unconditionally as "Pinned centrals (0)").

`npm run test:e2e -- settingsUxVisual.e2e.ts` → exit 1. Verbatim:

```
  ✓   2 e2e/settingsUxVisual.e2e.ts:106:1 › panel: WHEN the controls panel renders THEN its top-level disclosures are exactly the listed ones, in order (27ms)
  ✘   3 e2e/settingsUxVisual.e2e.ts:142:1 › panel: WHEN no central is pinned THEN the panel has no Pinned centrals disclosure (15.0s)
```
```
    Error: expect(locator).toHaveCount(expected) failed

    Expected: 0
    Received: 1
```
```
    > 147 | 	await expect(page.locator(TOP_LEVEL_PANEL_SUMMARY_SELECTOR).filter({ hasText: PINNED_CENTRALS_SUMMARY_PATTERN })).toHaveCount(0);
```
```
  1 failed
  2 passed (16.4s)
```
(Log: `.tmp/e2e-mutation.log`. The run stops at the first failure, hence 3 of 17.)

**Two things this proves**, and the second is the point of the ticket:
- the NEW test catches the unconditional render (`Received: 1`);
- the EXISTING exhaustiveness test (#2) stayed GREEN under the same mutation — the
  blind spot was real, and only the new assertion closes it.

**Mutation REVERTED.** `git diff src/` is empty (0 lines). Re-ran the gate after
revert: `17 passed (4.1s)`, exit 0 (`.tmp/e2e-reverted.log`) — this also rebuilds
`main.js`/`.dev-vault` from unmutated sources.

No environment defects found; the real-Obsidian suite runs fine here.

## Rejected alternatives

- **Relax the exhaustiveness filter to a substring, or drop it and let the count
  catch the regression.** Rejected: explicitly out of scope, and the filter's
  full-text anchoring exists so a future real "Pinned centrals defaults" section
  cannot slip through. A separate assertion is the honest fix.
- **Absence assertion via `.filter({ hasText: PINNED_CENTRALS_SUMMARY })` (bare
  substring).** Rejected: it would also fail on a legitimate future
  "Pinned centrals defaults" section — a false red. The anchored pattern matches
  exactly what `GraphToolbar` renders.
- **Hoist the locator into a variable for readability.** Rejected: `selectorGuard`'s
  exemption is line-scoped and only recognises a single chained statement.
- **Put the test in `pinnedCentralScenario.e2e.ts`.** Rejected: that file pins in
  its serial flow, so the GIVEN would depend on test ordering. `settingsUxVisual`
  never pins and already owns the exhaustiveness pin the new test complements.
- **Leave the anchored regex inline in both places.** Rejected by the ticket's DRY
  constraint — two copies of the same rendered-text shape is knowledge duplication.
