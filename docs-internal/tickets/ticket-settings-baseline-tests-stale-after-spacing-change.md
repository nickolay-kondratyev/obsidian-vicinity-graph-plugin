# Ticket: settings baseline tests are stale since the node-spacing default change (RED on `main`)

**Status:** OPEN — pre-existing test failure, found while implementing `node-outline`.
**Origin:** commit `22bd5cb` "Adjust node spacing defaults and increase one of the max in settings" changed `SETTINGS_SPEC` values but did not update the three baseline tests that pin them.

## Problem

`npm test` is RED on `main` (and therefore on every branch cut from it) with **3 failures**,
all in engine settings baseline tests, all the same root cause — the spec moved, the
assertions did not:

| Test | Expected (test) | Actual (spec) |
|---|---|---|
| `src/engine/SettingsSpec.test.ts` › "default values equal the exact shipped baseline" | `collidePaddingPx: 20` | `50` |
| `src/engine/SettingsSpec.test.ts` › "limits equal the exact shipped baseline" | `linkGapPx.max: 150`, `collidePaddingPx.max: 80` | `250`, `100` |
| `src/engine/forceLayoutSettings.test.ts` › "defaults equal the ticket-03 shipped layout constants" | `collidePaddingPx: 20` | `50` |

These are **behaviour-capturing baseline tests** by design: they exist so a default cannot
drift silently. They did their job — the drift is real and deliberate, only the baseline
was never re-pinned.

## Why it was NOT fixed in passing

Re-pinning a baseline is a statement that the NEW values are the intended shipped defaults.
That is the author's call, not a passing implementer's: the `forceLayoutSettings.test.ts`
docstring ties the numbers to the ticket-03 placement-quality work (and the d3 stranding
regression test runs at these defaults), so "just update the numbers" would be aligning an
assertion to an unverified change.

## Fix (when picked up)

1. Confirm `collidePaddingPx: 50`, `linkGapPx.max: 250`, `collidePaddingPx.max: 100` are the
   intended shipped values (a dev-vault look at a crowded graph is enough).
2. Update the three assertions, and the `forceLayoutSettings.test.ts` docstring if the
   ticket-03 provenance no longer holds.
3. Re-run the d3 stranding regression (`src/view/d3ForceStranding.test.ts`) — it runs at
   these defaults.

## Acceptance

- `npm test` green with no assertion loosened (exact values, not ranges).
