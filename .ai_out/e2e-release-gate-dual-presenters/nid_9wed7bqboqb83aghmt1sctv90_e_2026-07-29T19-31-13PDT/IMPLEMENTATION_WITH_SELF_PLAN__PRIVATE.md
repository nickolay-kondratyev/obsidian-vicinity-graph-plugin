# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (rehydration memory)

Ticket `nid_9wed7bqboqb83aghmt1sctv90_e`. Branch
`nid_9wed7bqboqb83aghmt1sctv90_e_2026-07-29T19-31-13PDT`. Work is COMPLETE and
committed as `f7588b9`. If you are rehydrating: everything below is already done.

## Environment — the e2e gate JUST WORKS here

Linux container, node v26.5.0, no `$DISPLAY`, no `$WAYLAND_DISPLAY`.

- `.tmp/obsidian/obsidian-1.12.7/obsidian` was ALREADY cached (from an earlier
  session). `scripts/setup-obsidian-bin.sh` would have downloaded it otherwise.
- `scripts/run-e2e.sh` auto-exports `OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless
  --disable-gpu"` when no display is detected. It works. No xvfb needed.
- `npm run test:e2e` from the repo root, no env vars: **works, ~55s, exit 0.**
- Iterating on ONE spec is much faster than the full runner (which rebuilds and
  reseeds the dev vault every time). The incantation:

```bash
OBSIDIAN_PATH="$PWD/.tmp/obsidian/obsidian-1.12.7/obsidian" \
OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu" \
npx playwright test --config e2e/playwright.config.ts settingsUxVisual -g "no section clips"
```

  ⚠ That path SKIPS the build+seed step, so after editing `src/` you must run
  `npm run setup:dev-vault` (or `npm run build`) yourself or the Obsidian instance
  loads the previous bundle. I lost one confusing cycle to this. `styles.css` is
  generated from `src/view/*.css`, so CSS edits absolutely need the rebuild.
- Bash calls in this harness reset cwd between invocations → absolute paths, or a
  leading `cd` inside the same compound command.

## What I actually did, in order

1. Read the ticket, README's e2e section, `scripts/run-e2e.sh`, the previous
   ticket's PUBLIC.md.
2. Ran the full gate UNCHANGED: **94 passed / 1 skipped / exit 0**
   (`.tmp/e2e_run1.log`). All four at-risk specs passed as the previous ticket left
   them. Note the "controls-panel disclosure spec" the ticket asks you to find is
   NOT a separate file — the derived baseline is `e2e/settingsBaseline.ts`, asserted
   from `settingsUxVisual.e2e.ts` + `settingsResetReview.e2e.ts`.
3. Because green says nothing about the flagged WRAPPING risk, wrote a throwaway
   probe spec `e2e/zzPanelLabelProbe.e2e.ts` (deleted before commit; testDir is
   `e2e/` with `testMatch **/*.e2e.ts`, so a temp spec must live there and must be
   removed or it joins the gate). It opened `.vicinity-graph-toolbar` and every
   nested `<details>` via `el.open = true` (the same idiom as the spec's `setOpen`)
   and measured labels: `scrollWidth` vs `clientWidth`, box vs panel right edge,
   height/line-height.
4. Probe v1 measured the wrong elements (whole rows, incl. inputs, so the "lines"
   heuristic lied). v2 measured the label spans:
   `.vicinity-graph-number-row > span`, `.vicinity-graph-slider-row__label`,
   `.vicinity-graph-sizing__toggle span`, `.vicinity-graph-exclusion__toggle-row >
   span`, `.vicinity-graph-nodecontents__label`, `.vicinity-graph-stepper__label`.
   Result: ZERO clipping, ZERO horizontal overflow; three labels wrap to 2 lines.
5. Looking at the probe SCREENSHOT is what found the real bug — sections visibly cut
   mid-row. Probe v3 confirmed it numerically (per-`<details>` clientHeight vs
   scrollHeight, plus body client/scroll).
6. Fixed `.vicinity-graph-toolbar__body > * { flex-shrink: 0; }`, rebuilt, re-probed
   → clean. Deleted the probe. Ported its measurement into a permanent BDD test in
   `e2e/settingsUxVisual.e2e.ts`.
7. RED-verified the new test by flipping the rule to `flex-shrink: 1`, reseeding,
   re-running (`.tmp/red.log`, `.tmp/red2.log`). Restored from `.tmp/graph-view.css.bak`.
8. `npm run check` 0, `npm test` 1139 passed, full `npm run test:e2e` **95 passed /
   1 skipped / exit 0**. Committed.

## The bug, in one paragraph (so you don't re-derive it)

`.vicinity-graph-toolbar__body` = `display:flex; flex-direction:column;
max-height:60vh; overflow-y:auto`. Flex children default to `flex-shrink: 1`, so the
section `<details>` shrank to fit the cap rather than overflowing it; the body's
`scrollHeight` therefore equalled its `clientHeight` (no scrollbar), and
`.vicinity-graph-disclosure { overflow: hidden }` clipped each section's rows.
Measured pre-fix with all six open: 479/479 body, Node sizing 138 of 336. Post-fix:
1086/479 body, nothing clipped.

## Ordering / state gotchas in `settingsUxVisual.e2e.ts`

- It is `test.describe.configure({ mode: "serial" })` with ONE Obsidian for the file.
- I inserted the new test AFTER "…top-level disclosures are exactly the listed ones,
  in order" (which is what licenses indexing `topLevelPanelDisclosures().nth(i)`
  against `CONTROLS_PANEL_DISCLOSURES` order) and BEFORE "exclusion toggle switches
  on…".
- It leaves the panel in the DECLARED default open/closed state (loops
  `CONTROLS_PANEL_DISCLOSURES` `startsOpen`), so the later specs' screenshots don't
  inherit a fully-expanded panel. Without that restore the suite still passes (every
  later test opens what it needs explicitly) — the restore is about screenshot
  evidence, not correctness.
- Assertion ORDER inside the test is deliberate: the clipped-sections assert comes
  first so the red names the damage; the non-vacuity (body must overflow) assert is
  second. Reversed, the red reads like a fixture problem. I tried both.

## Things I deliberately did NOT do

- Did not touch the four rewritten specs — they were correct; changing them would
  have been assertion churn.
- Did not re-abbreviate any panel label. The measurements say the longer labels are
  fine; the keep/revert call is the owner's in `nid_0u28xzhz05qewz35jfqkxkvz2_e`.
- Did not widen the panel or change the 60vh cap. Out of scope; noted as an open
  risk in PUBLIC.md.
- Did not touch tickets or the change log (TOP_LEVEL_AGENT owns those).

## Artifacts

Logs: `.tmp/e2e_run1.log` (baseline), `.tmp/e2e_run2.log` (final), `.tmp/unit1.log`,
`.tmp/check1.log`, `.tmp/build_fix.log`, `.tmp/probe{1,2,3,4}.log`, `.tmp/red.log`,
`.tmp/red2.log`, `.tmp/uxspec.log`, `.tmp/graph-view.css.bak`.
Screenshots: `.out/panel-label-probe/` (probe, pre-fix), `.out/settings-ux/` (suite).
