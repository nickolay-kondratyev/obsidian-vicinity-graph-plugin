# Ticket: SETTINGS_SPEC baseline tests stale after the node-spacing default bump

**Status:** CLOSED — resolved on branch `settings` (settings restore-defaults round, iteration 1).
**Origin:** Found (not caused) by the settings restore-defaults round on branch `settings`.
Reproduces on a clean checkout of `22bd5cb` — `git stash -u && npm test` fails identically.

`22bd5cb` ("Adjust node spacing defaults and increase one of the max in settings") changed
`SETTINGS_SPEC.globalView.forceLayout.collidePaddingPx` default `20 → 50` (and its `max`
`80 → 100`) without updating the tests that pin the shipped baseline. Three tests fail:

- `src/engine/SettingsSpec.test.ts` — "…default values equal the exact shipped baseline"
- `src/engine/SettingsSpec.test.ts` — "…limits equal the exact shipped baseline"
- `src/engine/forceLayoutSettings.test.ts` — "…equal the ticket-03 shipped layout constants"

These are behavior-capturing baselines, so they are deliberately NOT touched here: the fix
needs a human decision on whether `50 / max 100` is the intended new shipped default (in
which case the baselines are updated to match) or the bump was accidental.

Also stale, same commit: the `collidePaddingPx` doc comment in `src/engine/SettingsSpec.ts`
still reads "20 validated by the ticket-03 prototype" and documents the range as `[0, 80]`.
Whichever way the value question is decided, that comment must be brought back in sync.

## Resolution

The human confirmed the bump was **intended**: `collidePaddingPx` default `50`, `max 100`
(and `linkGapPx` `max 250`) are the shipped truth. So the baselines were realigned to the
shipped spec, not the other way round:

- `src/engine/SettingsSpec.test.ts` — defaults baseline `collidePaddingPx: 50`; limits
  baseline `collidePaddingPx { max: 100 }` and `linkGapPx { max: 250 }` (the latter was
  stale from the same commit).
- `src/engine/forceLayoutSettings.test.ts` — `collidePaddingPx: 50`; the describe/docblock
  no longer claims the whole baseline is ticket-03's, and names `22bd5cb` as the deviation.
- `src/engine/SettingsSpec.ts` — the `collidePaddingPx` and `linkGapPx` doc comments now
  document the shipped values and ranges.

`npm test` is fully green (769 passed, 0 failed).
