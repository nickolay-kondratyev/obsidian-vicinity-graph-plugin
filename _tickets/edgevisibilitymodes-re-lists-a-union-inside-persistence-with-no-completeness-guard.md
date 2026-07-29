---
closed_iso: 2026-07-29T17:30:46Z
id: nid_3k0a4zl6in0mj8lcjibkjq2dx_e
title: "EDGE_VISIBILITY_MODES re-lists a union inside persistence with no completeness guard"
status: closed
deps: []
links: [nid_niz5dz6uqeyv237ckm15ittqa_e, nid_abreq4lmpo8vnvf61y9k9yly0_e, nid_8p0nn2g34d97finokwlz3u1dt_e]
created_iso: 2026-07-25T03:52:21Z
status_updated_iso: 2026-07-29T17:30:46Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [engine, persistence]
---

`src/persistence/persistedShapes.ts` (~:66) declares `EDGE_VISIBILITY_MODES` locally, re-typing the members of an engine union so parsing can validate them. Nothing makes it fail when the union gains a member — the parser would then silently reject a value the engine considers legal.

`node-content-preference` introduced the better idiom right next to it: `NODE_PREVIEW_PREFERENCES` lives in `src/engine/types.ts` as `[...] as const satisfies readonly NodePreviewPreference[]`, is re-exported from `src/engine/index.ts`, has a compile-time `_assertEveryNodePreviewPreferenceListed` guard, and persistence imports it instead of re-listing it.

Two idioms side by side is the drift worth removing.

## Acceptance Criteria

`EDGE_VISIBILITY_MODES` moved to `src/engine/types.ts` next to its union with the same `satisfies` + listing-assert treatment, exported through `src/engine/index.ts`, and imported by `persistedShapes.ts`. Clean break, no deprecated alias. `persistedShapes.test.ts` still green; add a case only if the move exposes a real gap.


## Notes

**2026-07-29T17:30:46Z**

CLOSED as OBSOLETE by the owner decision of 2026-07-29 (see nid_niz5dz6uqeyv237ckm15ittqa_e).

This ticket asked for a completeness guard on EDGE_VISIBILITY_MODES, which is re-listed in
src/persistence/persistedShapes.ts with no link back to the engine union. That problem disappears
entirely: edgeVisibility was found to be unreachable dead config (no write path anywhere except an
e2e harness poke) and is being DELETED outright, taking the EdgeVisibilityMode union and both of its
listings with it.

NOT closed because the underlying concern was wrong -- "a union re-listed in persistence with no
completeness guard" is a real class of bug. It is now covered generically by the compile-time
exhaustiveness guards in settings cleanup E1 (nid_wimjq4ewgbg21n4zx9d4qq3a0_e), which is where any
SURVIVING union should get its guard. Reopen only if edgeVisibility comes back as a real feature.
