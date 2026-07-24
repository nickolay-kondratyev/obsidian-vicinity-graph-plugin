# Ticket: one settings LIMITS baseline is stale since the node-spacing change (RED on `main`)

**Status:** OPEN — pre-existing test failure, now narrowed to **1 assertion**.
**Origin:** commit `22bd5cb` "Adjust node spacing defaults and increase one of the max in
settings" changed `SETTINGS_SPEC` values without re-pinning the baselines. Commit `a6668b5`
re-pinned the **defaults** block only — the **limits** block was left behind.

> **Sibling ticket:** `ticket-settings-spec-baseline-tests-stale-after-node-spacing-bump.md`
> (CLOSED) covers the SAME root cause — the `settings` and `node-outline` branches each
> filed one before they merged. That one records the `collidePaddingPx` / `linkGapPx`
> re-pin; this one carries the single item still RED.

## Problem

`npm test` is RED on `main` (and therefore on every branch cut from it) with **1 failure**:

| Test | Expected (test) | Actual (spec) |
|---|---|---|
| `src/engine/SettingsSpec.test.ts` › "WHEN the spec is read THEN its limits equal the exact shipped baseline" | `forceLayout.linkStrengthFactor.max: 2` | `4` |

Already re-pinned by `main` and no longer failing (recorded so the history reads straight):
the `collidePaddingPx` default (`20 → 50`, in both `SettingsSpec.test.ts` and
`forceLayoutSettings.test.ts`) and the `linkGapPx.max` / `collidePaddingPx.max` limits.

This is a **behaviour-capturing baseline test** by design: it exists so a limit cannot drift
silently. It did its job — the drift is real and deliberate, only the baseline was never
re-pinned.

## Why it is NOT fixed in passing

Re-pinning a baseline is a statement that the NEW value is the intended shipped limit. That
is the author's call, not a passing implementer's: `22bd5cb` raised the max deliberately but
nothing records what `4` was validated against, so "just update the number" would be aligning
an assertion to an unverified change.

## Fix (when picked up)

1. Confirm `linkStrengthFactor.max: 4` is the intended shipped limit (a dev-vault look at a
   graph with link force pushed to the new maximum is enough).
2. Update that one assertion in `src/engine/SettingsSpec.test.ts`.

## Acceptance

- `npm test` green with no assertion loosened (exact value, not a range).
