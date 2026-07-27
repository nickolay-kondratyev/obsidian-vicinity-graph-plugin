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

---

# Round 2 (fresh instance) — delta `517b391`. Verdict: CONVERGED, 0 blocking.

## Verified facts (re-checkable)
- `npm test` → 76 files / 1014 tests, exit 0 (`.tmp/rev2-test.log`). `npm run check` exit 0
  (`.tmp/rev2-check.log`). `git diff main...HEAD --stat -- src` = 4 files, ALL `*.test.ts`.
- S1 comment (`GraphStructureDiff.test.ts:49-54`) names three guards that all exist:
  `NodeSizer.test.ts:325`, `VicinityEngine.test.ts:340`, `flowMapping.test.ts:600`.
  Diff touches comment lines only — assertion/WHY untouched.
- S2 vacuity check DONE, the key thing a round-3 would otherwise redo:
  probe test dumping `data.preview` for the exact fixture gives
  `auto → ["thumbnail","none"]`, `outline → ["outline","none"]`, `image → ["thumbnail","none"]`.
  So `a.md` (renderable level-1 outline + `firstImagePath` + `imagePrecedesOutline:true`)
  reaches `nodePreviewKind`'s preference `switch` (`src/view/nodePreviewChoice.ts`) instead of
  either single-sided short circuit. Test is NOT tautological.
- Mutation replay (my own, worktree `.worktree/rev2`, removed): `height + 30` for `"image"` in
  the `noteNodes` map of `flowMapping.ts` → `1 failed | 62 passed`, failure is exactly the new
  test, diff shows `160→190` / `40→70` under key `"image"`. Implementer's claim is accurate.
- NIT rejections N1/N2 upheld as reasonable. N1 empirically justified: the keyed map is what
  named `"image"` in the failure diff. N2 stronger now (idiom spans engine + view layers).

## Left as optional, deliberately not blocking
- New test asserts geometry only; the "preview flips" premise is a comment, not an assertion →
  a future fixture trim (drop `firstImagePath`) would silently make it vacuous.
- `change_log` / merge / ticket state still TOP_LEVEL_AGENT's.
- `517b391` also adds open ticket `nid_brwl5gfd2l2ephq9pdiqfkqzp_e` (image nodes need space) —
  whoever picks it up must not make `sizePx` preference-dependent.
