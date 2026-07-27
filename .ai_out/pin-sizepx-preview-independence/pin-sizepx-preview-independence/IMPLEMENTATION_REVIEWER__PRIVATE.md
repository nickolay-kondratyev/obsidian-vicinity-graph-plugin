# PRIVATE reviewer notes — rehydration

Reviewed commit `16bed89` on `pin-sizepx-preview-independence`. Verdict: APPROVE,
0 blocking, 2 SHOULD-FIX (S1 stale comment, S2 flowMapping guard), 3 NITs.

## Verified facts (re-checkable)
- `npm test` → 76 files / 1013 tests, exit 0. `npm run check` → exit 0.
  Logs: `.tmp/rev-test.log`, `.tmp/rev-check.log`.
- Diff touches NO `src/**` non-test file. Confirmed via `--stat`.
- `SizingSettings` at `src/engine/types.ts:245` has NO `nodePreviewPreference`.
  `NodeSizer.computeSizes(nodes, rawSettings: SizingSettings)` unchanged.
- Test passes a named local (`settings`), not a fresh literal → TS excess-property
  check does not fire. That is WHY it type-checks without a cast. No `as any` anywhere.
- `NODE_PREVIEW_PREFERENCES` is `as const satisfies` (types.ts:175) → tuple → `[0]`
  safe under `noUncheckedIndexedAccess`.

## Mutation replays I ran myself (worktree `.worktree/rev-mutation`, removed after)
- A: probe cast inside `NodeSizer.computeSizes`, double `maxPx` for "image"
  → NodeSizer.test FAILS, VicinityEngine.test PASSES.
- C: coupling only at `VicinityEngine.ts:63` (`maxPx * 2` for "image")
  → VicinityEngine.test FAILS at `:350`, NodeSizer.test PASSES.
  **This is the key finding**: the mandated NodeSizer test is narrow; the
  engine test (added beyond ticket scope) carries the realistic coverage.

## Why S2 (push-back on the decline)
Implementer declined a `graphIdentity.test.ts` guard — correct, `nodeDimensionsPx`
takes only a `GraphNode`. But `src/view/flowMapping.ts` DOES have the preference in
scope (`nodePreviewKind` at :322) and sets node width/height at :188-196. That is
the plausible regression site ("image preview needs a taller box") and is unpinned.
Recommend a follow-up ticket, not reopening this one.

## Not chased
- e2e (`npm run test:e2e`) — release gate, not applicable to a test-only engine change.
- change_log entry — TOP_LEVEL_AGENT owns it; flagged as outstanding.
