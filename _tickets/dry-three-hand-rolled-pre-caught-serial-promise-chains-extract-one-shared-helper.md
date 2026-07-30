---
closed_iso: 2026-07-30T01:18:01Z
id: nid_4zffe7mj5p1eabi9m6wfh06k0_e
title: "DRY: three hand-rolled pre-caught serial promise chains — extract one shared helper"
status: closed
deps: [nid_m5hxe4eo9jgt7cfic7s2o3uvi_e]
links: [nid_m5hxe4eo9jgt7cfic7s2o3uvi_e, nid_8b97fdqznqsncc5kgya1p871w_e]
created_iso: 2026-07-27T23:42:49Z
status_updated_iso: 2026-07-30T01:18:01Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, persistence, settings-cleanup]
---

Overarching context and chain ordering for the settings cleanup: docs-internal/notes/settings.md (grouping tag: settings-cleanup).
The idiom `tail = tail.catch(() => undefined).then(task)` (a serial write chain where one rejection cannot wedge the chain, while the failure still reaches its own caller) is now hand-rolled in three places:

- `src/persistence/PluginDataStore.ts` — `writeChain` (~L70-71)
- `src/view/settingsDebounce.ts` — `draining` (~L96-106)
- `src/view/settingsWriteQueue.ts` — `tail` (added by nid_7ni3rjx3bx6w2bdfvpp7wj0xb_e)

The knowledge duplicated is subtle and easy to get wrong: the pre-catch must be applied to the STORED tail, not to the RETURNED promise, or callers stop seeing their own failures.

Raised as a non-blocking DRY observation by IMPLEMENTATION_REVIEWER in .ai_out/settings-write-serialization/settings-write-serialization/IMPLEMENTATION_REVIEW__PUBLIC.md.

## Design

Extract a small pure `SerialPromiseChain` (or similar) into a shared module — likely `src/shared/` so both `src/persistence/` and `src/view/` may import it without violating layering (verify against docs-internal/architecture-map.md; `src/shared/` is guarded pure by an import test).

Each of the three sites then holds an instance instead of a raw promise field. Keep the existing per-site public API (`persist`, `drain`, `enqueue`) unchanged so no caller moves.

80/20 check: three occurrences is the threshold where extraction pays; below that, leave it. Do not generalize beyond what the three sites actually need (no priorities, no cancellation, no keying — `DocDataStore.enqueue` keys by docid and may or may not fit; if forcing it in adds complexity, leave it out and say so).

## Acceptance Criteria

GIVEN the three chaining sites
WHEN the shared helper is in place
THEN each site delegates to it, the helper has colocated BDD tests covering ordering + rejection-isolation + caller-surfacing, and `npm test` / `npm run check` stay green.


## Notes

**2026-07-30T01:18:01Z**

RESOLVED by nid_m5hxe4eo9jgt7cfic7s2o3uvi_e (write/refresh pipeline), commits 7588c2b..5520cfa.

One helper: src/shared/SerialPromiseChain.ts (pure -- no obsidian/react imports, per the layering rule; covered by src/shared/SerialPromiseChain.test.ts). All three hand-rolled chains are gone:
- PluginDataStore's writeChain -> uses the shared chain
- settingsDebounce -> has NO chain of its own any more; its window drains onto the pipeline
- settingsWriteQueue.ts -> DELETED (its three behaviours are re-covered in SerialPromiseChain.test.ts)

The previously UNQUEUED fourth write site (ControlsActions, including pins) is now on the same chain, so there is exactly one serialisation point for every settings write. A rejecting task does not poison the chain.
