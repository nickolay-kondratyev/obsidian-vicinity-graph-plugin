# UI_IMPLEMENTATION_REVIEW — PRIVATE working notes (rehydration state)

## Status
Review COMPLETE. Verdict READY. Public report:
`.ai_out/settings-ux-improvements/settings/UI_IMPLEMENTATION_REVIEW__PUBLIC.md`.

## Environment facts (re-usable)
- e2e works here out of the box: `npm run build` then
  `npm run test:e2e -- <specFile>`. `OBSIDIAN_PATH` is already set in the env.
- Playwright config only picks up `e2e/*.e2e.ts` — a scratch spec must live there
  (a spec under `.tmp/` yields "No tests found").
- Screenshots → `.out/settings-reset-review/` (untracked).
- `npm test`: 756 pass / 3 fail — the 3 are the known pre-existing
  SETTINGS_SPEC + forceLayoutSettings `collidePaddingPx` baselines (ticketed).
  `npm run check` exit 0.

## Traps hit while reviewing (do not re-litigate)
- `applyReset` awaits its slice writes in sequence; reading the store immediately
  after a click/Enter races the LAST write. Use `expect.poll`. This is a TEST
  artifact, NOT a product bug — the tab re-renders only after all writes.
- Narrow-width check by forcing container `width: 320px` is a proxy only:
  Obsidian's own responsive settings rules key off `is-mobile`, not width. The 5
  overflowing rows it reports are the pre-existing sizing-metric rows
  (toggle + number in ONE row) — pre-existing, out of scope, do not report.
- `groupByFolder` / `edgeVisibility` have NO UI surface anywhere (confirmed by
  grep over `src/view` + `src/adapters`). The `all` scope resetting them is
  invisible to users → NOT a scope-honesty finding. Initially suspected; dropped.

## Measurements captured
- Modal focus probe: initial `Cancel` `focusVisible=false`; Tab1 → confirm
  `focusVisible=true`; Tab4 escapes to the file-explorer tree, Tab5 returns.
- Footer spacing: `beforeFooter > betweenCards` asserted numerically (gap
  `--size-4-4` + `margin-top: --size-4-4`, additive in flex).

## Judgment calls (rationale, if challenged)
- MAJOR-1 (unconfirmed exclusion-pattern deletion) is deliberately NOT called
  BLOCKING: the description states the behavior, so it is honest; it is a
  friction-vs-blast-radius policy call that TOP_LEVEL already decided (#2) without
  seeing the asymmetry. Human decision, not a correctness defect.
- NIT-2 (focus escape) is attributed to stock Obsidian `Modal`; ConfirmModal adds
  no tabindex. Not worth a fix in this repo. If ever challenged, the way to settle
  it is to tab through any core Obsidian modal and compare.
- NIT-4 (details no longer last in the Force layout card) was verified visually
  (`card-forcelayout-light.png`) — the reset row genuinely reads as a footer, so
  the skill's intent is met even though its letter is not.

## Files
- NEW (kept): `e2e/settingsResetReview.e2e.ts` — 9 tests, all passing.
- `src/` untouched (readonly per instructions).
