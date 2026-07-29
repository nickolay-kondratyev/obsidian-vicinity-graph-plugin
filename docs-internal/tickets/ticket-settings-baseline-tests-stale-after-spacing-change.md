# Ticket: one settings LIMITS baseline is stale since the node-spacing change (RED on `main`)

**Status:** RESOLVED (verified 2026-07-29) — the assertion no longer fails.

`npm test` is GREEN on `main`: 84 files, 1153 passed, 1 expected-fail. The specific drift this
ticket tracked is gone — `SettingsSpec.ts:235` ships `linkStrengthFactor: { max: 4 }` and
`SettingsSpec.test.ts:190` expects `max: 4`. They agree.

WHY this is recorded rather than deleted: this file plus its sibling
(`ticket-settings-spec-baseline-tests-stale-after-node-spacing-bump.md`) are the two concrete
instances that justify settings-cleanup **E4** (`nid_x6hgehsu5il1d1shuraz3ufqy_e`) — hand-enumerated
`toEqual` literals go stale every time a default moves. E4 replaces them with spec-iterating
structural tests so this class of staleness stops recurring.
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
is the author's call, not a passing implementer's: the `linkStrengthFactor.max 2 → 4` raise
landed separately, in `dee64c3` ("Modified file: SettingsSpec.ts"), as a one-line hand-edit —
NOT in `22bd5cb`, which touched only `linkGapPx.max` and `collidePaddingPx`. Nothing there
records what `4` was validated against, so "just update the number" would be aligning an
assertion to an unverified change.

## Fix (when picked up)

1. Confirm `linkStrengthFactor.max: 4` is the intended shipped limit (a dev-vault look at a
   graph with link force pushed to the new maximum is enough).
2. Update that one assertion in `src/engine/SettingsSpec.test.ts`.

## Acceptance

- `npm test` green with no assertion loosened (exact value, not a range).

## Note 2026-07-25 — step 2 already happened; only step 1 is left

Observed while closing `nid_abreq4lmpo8vnvf61y9k9yly0_e` (baseline-test exhaustiveness):
**the RED described above no longer reproduces.** `main` re-pinned the assertion to
`linkStrengthFactor.max: 4` in `258ec5a`, so test and spec agree and the suite is green
(922 passed, 0 failed) — verified independently by two agents. The "Problem" table above is
stale as a statement of current state.

Left OPEN deliberately: the re-pin landed without the **step 1** confirmation this ticket
asks for — nothing yet records that `4` was validated as the intended shipped limit. That
is a human call, so only a human should close this.

## Note 2026-07-27 — `258ec5a` carries a human intent statement (step 1, partially)

`258ec5a`'s commit message ends: `Human-decided (2026-07-24): the shipped spec value is the
intended one.` So `4` being **intended** is on record; what is still not on record is what it
was **validated against** (step 1 asks for the dev-vault look). Whether that trailer is enough
to close remains the human's call — status left untouched.
