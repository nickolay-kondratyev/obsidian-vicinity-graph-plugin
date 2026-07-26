# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket `nid_vqw34wdpmb5qzn52cy6qugqgd_e` — controls-panel disclosures had no
exhaustiveness pin. Branch `e2e-controls-panel-disclosure-exhaustiveness`.
Commit `1a38ca4`.

## Plan (as executed)

1. `e2e/settingsBaseline.ts`: derive `CONTROLS_PANEL_DISCLOSURE_SUMMARIES` (mirrors the
   existing `SETTINGS_TAB_SECTION_HEADINGS` shape), add `PINNED_CENTRALS_SUMMARY`,
   rewrite the `CONTROLS_PANEL_DISCLOSURES` doc to state the new enforcement mechanism.
2. `e2e/settingsUxVisual.e2e.ts`: one new BDD test pinning count + identity + order of the
   panel's TOP-LEVEL disclosures.
3. Verify: `npm run check`, `npm test`, scoped e2e; then empirically prove the acceptance
   criterion by temporarily adding a 6th disclosure.

## The assertion

```ts
function topLevelPanelSummaries(): Locator {
	return page
		.locator(".vicinity-graph-toolbar__body > .vicinity-graph-disclosure > .vicinity-graph-disclosure__summary")
		.filter({ hasNotText: PINNED_CENTRALS_SUMMARY });
}
```
then `toHaveCount(CONTROLS_PANEL_DISCLOSURE_SUMMARIES.length)` followed by
`toHaveText(<prefix regexes built from the same array>)`.

## Decisions + WHY

**"Pinned centrals (n)" — HARDENED by name, not left to the fixture.** It is a real direct
child of `.vicinity-graph-toolbar__body` when it renders (`src/view/GraphToolbar.tsx:46-52`).
`settingsUxVisual.e2e.ts` never pins a central today, but that is an invisible fixture
invariant: the day a test earlier in this serial file pins one, the count silently becomes 6
and the suite goes red for a non-regression. `.filter({ hasNotText: PINNED_CENTRALS_SUMMARY })`
costs one line and a comment, so the robust option was free. The WHY lives both in the
locator's doc comment and on `PINNED_CENTRALS_SUMMARY` itself.

**"Advanced spacing" — excluded STRUCTURALLY, no name needed.** It is nested inside the
Force-layout disclosure's own body (`src/view/ForceLayoutSection.tsx:50`), so the
direct-child chain never reaches it. No maintenance surface.

**Identity + order pinned, via PREFIX regexes rather than exact strings.** The brief said to
fall back to a bare count only with evidence — here is the evidence, and it justified a middle
option instead of the fallback: `src/view/NodeExclusionSection.tsx:44-56` renders the summary as
`<span>Node exclusion</span>` plus a CONDITIONAL excluded-count `<span>`, so that summary's
textContent is `"Node exclusion"` or `"Node exclusion12"` depending on fixture state. Exact
`toHaveText` would therefore be a latent flake for that one entry. `toHaveText` with
`^`-anchored prefix regexes keeps count + identity + order while tolerating the badge. The
regex source is escaped (same idiom as the slider-readout test at the bottom of the file).

**Both `toHaveCount` and `toHaveText`.** `toHaveText` on an array already enforces the count,
but the count assertion fails first with `Expected: 5 / Received: 6` — the diagnosis a future
reader wants — instead of a text-array diff. Mirrors the settings tab, which also asserts both.

**A separate test, not an extension of "panel defaults".** One behavior per test: the existing
test asserts default OPEN STATE, the new one asserts the SET of disclosures.

## Files changed

- `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2/e2e/settingsBaseline.ts`
  — `+CONTROLS_PANEL_DISCLOSURE_SUMMARIES`, `+PINNED_CENTRALS_SUMMARY`, doc update on
  `CONTROLS_PANEL_DISCLOSURES` stating that the list is now DOM-pinned and how each
  exclusion survives the pin. No existing export changed.
- `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2/e2e/settingsUxVisual.e2e.ts`
  — `+topLevelPanelSummaries()` locator + one new test. Nothing removed or weakened.

## Verification (real results)

| Command | Result |
|---|---|
| `npm run check` | exit 0 |
| `npm test` | exit 0 — 74 files, 990 tests passed |
| `npm run test:e2e -- settingsUxVisual` | exit 0 — **16 passed** (new test at :95 green) |
| `npm run test:e2e -- settingsUxVisual pinnedCentralScenario` (after revert) | exit 0 — **18 passed** |

Full suite deliberately NOT run: pre-existing RED at `e2e/vicinityGraph.e2e.ts:160`
(`nid_yccejkvl0ccqc77olsgg5deka_e`), not in scope.

### Acceptance-criterion proof (empirical)

Temporarily appended a 6th top-level `<Disclosure summary="TEMPORARY PROOF">` to
`src/view/GraphToolbar.tsx` after `<ForceLayoutSection/>`, re-ran the scoped e2e — it FAILED:

```
  ✓   1 e2e/settingsUxVisual.e2e.ts:61:1 › panel defaults: … only Depth starts open (116ms)
  ✘   2 e2e/settingsUxVisual.e2e.ts:95:1 › panel: WHEN the controls panel renders THEN its
        top-level disclosures are exactly the listed ones, in order (15.0s)

    Error: expect(locator).toHaveCount(expected) failed
    Locator:  locator('.vicinity-graph-toolbar__body > .vicinity-graph-disclosure >
              .vicinity-graph-disclosure__summary').filter({ hasNotText: 'Pinned centrals' })
    Expected: 5
    Received: 6
    at e2e/settingsUxVisual.e2e.ts:102:26

  1 failed / 14 did not run
```

Reverted (`git checkout -- src/view/GraphToolbar.tsx`) and re-ran → 18 passed. Working tree
contains no trace of the temporary change (`git status` clean at commit time).
Logs: `.tmp/e2e.log`, `.tmp/e2e-proof.log`, `.tmp/e2e-after-revert.log`.

## Rejected

- **Bare total count of `.vicinity-graph-disclosure`** — wrong by construction: counts the
  nested "Advanced spacing" and every future nested disclosure.
- **A vitest guard in `settingsBaseline.test.ts`** — cannot satisfy the acceptance criterion;
  nothing in node-side vitest can observe the panel DOM. That file's own doc already says the
  hand-written parts' "real pin is the DOM". Left untouched.
- **Relying on the fixture never pinning a central** — see the Pinned-centrals decision.

## Follow-ups worth a ticket (not filed — orchestrator's call)

- `e2e/controlsRestart.e2e.ts:80` and `e2e/pinnedCentralScenario.e2e.ts:95` still hard-code the
  literal `"Pinned centrals"`, which now also exists as `PINNED_CENTRALS_SUMMARY` in the
  baseline. Three literals for one string. Left alone to keep this change scoped; a two-line
  DRY pass would fold them in.
