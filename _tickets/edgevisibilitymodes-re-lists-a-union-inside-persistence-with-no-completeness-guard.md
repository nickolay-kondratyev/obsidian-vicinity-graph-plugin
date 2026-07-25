---
id: nid_3k0a4zl6in0mj8lcjibkjq2dx_e
title: "EDGE_VISIBILITY_MODES re-lists a union inside persistence with no completeness guard"
status: open
deps: []
links: []
created_iso: 2026-07-25T03:52:21Z
status_updated_iso: 2026-07-25T03:52:21Z
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

