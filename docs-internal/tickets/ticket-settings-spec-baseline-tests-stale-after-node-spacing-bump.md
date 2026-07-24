# Ticket: SETTINGS_SPEC baseline tests stale after the node-spacing default bump

**Status:** OPEN
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
