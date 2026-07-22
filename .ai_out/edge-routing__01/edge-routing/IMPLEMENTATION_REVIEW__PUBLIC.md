# edge-routing__01 — Implementation Review (PUBLIC)

**Overall signal: READY.** No BLOCKING issues. All acceptance criteria met; all gates independently re-run green.

## Independently verified gates (actual numbers)
| Gate | Result |
|------|--------|
| `npm run check` (tsc) | exit 0 — CLEAN |
| `npx vitest run` | **630 passed / 54 files**, exit 0 |
| `npm run build` | exit 0; wasm embedded (`loadAvoid`/`ShapeConnectionPin` present in main.js) |
| Node wasm probe | `AvoidLib.load()` OK ⇒ integration test's assertions REALLY run (not skipped, not fake-passed) |
| `Avoid.` grep | production usage ONLY in `edgeRouting.ts` + `libavoidLoader.ts` |
| Spike cleanup | 3 spike files deleted; `main.ts` clean; only test deletions are ticket-approved spike tests |

## Acceptance-criteria checklist
- [x] `edgeRouting` setting exists, default OFF, persisted, visible in settings tab (constants.ts:47, types.ts:202, persistedShapes.ts:132, ViewSettingsResolver.ts:51, VicinityGraphSettingTab.ts:49).
- [x] Setting ON ⇒ edges carry `routedPoints` (controller threading tests; rendering unchanged).
- [x] Unit tests pass; `check` clean; full vitest green.
- [x] No libavoid object leaks outside `LibavoidEdgeRouter` (grep-verified).
- [x] Reuse-layout rebuilds don't re-run libavoid when inputs unchanged (test asserts callCount==1).

## Findings (classified)

### BLOCKING
None.

### SHOULD-FIX
None.

### NICE-TO-HAVE (non-blocking; leave to implementer's discretion)
1. **Asymmetric handling of "missing endpoint"** — `extractEdgeRoutingInput` silently drops an edge whose endpoint node lacks a position/dimensions (`edgeRouting.ts:106-108`), whereas the router THROWS on the equivalent inconsistency (`edgeRouting.ts:236`). Both guard states that cannot occur post-layout (every flow node has a position) and both are documented, so this is cosmetic. No change required.
2. **`routingSignature` order-dependence** (`GraphViewController.ts:328`) — the signature relies on stable flow node/edge ordering for a given graph. If ordering ever varied for the same id-set, the cache would over-invalidate (recompute) — a *safe* direction (never a stale route). Fine as-is; the comment already notes the stability assumption.

### Positive callouts
- **Memory safety is sound.** `AvoidArena` (`edgeRouting.ts:138-182`) tracks only leaf objects (Point/Rectangle/ConnEnd) and destroys the Router last; ShapeRef/ConnRef/Pin stay router-owned. The real-wasm integration test allocates shapes+pins+connector, runs `processTransaction`, and disposes two routers against one Avoid instance with **no abort** — concrete evidence of no double-free/leak.
- **Failure containment matches the spec exactly** — single pass-level `try`, warn-once, straight-edge fallback; router throws rather than per-edge silently skipping.
- **Route cache key is complete** (obstacle geometry + edge endpoints = the entire router input) — not too weak (no stale routes) and safe if too strong. Flip-OFF nulls the cache so a later ON recomputes without forcing an elk relayout; stale async passes return before writing the cache (no poisoning).
- **Lazy `await import("./libavoidLoader")`** (`edgeRouting.ts:206`) is JUSTIFIED, not a hack: a static import would pull the esbuild-only virtual wasm module into vitest and break the suite. The WHY-comment documents it and it enables clean loader mocking in tests.
- Settings wiring cleanly mirrors `groupByFolder`/`layoutMode` end-to-end (type → default → resolver → persist-parse → write-plan → settings tab).
- Threading stops at data (`VicinityEdgeData.routedPoints`) — rendering does NOT branch on it; ticket-02 boundary respected. Absolute-coord comments present at both threading seams.
- Tests use a `FakeEdgeRouter` (DIP), BDD GIVEN/WHEN/THEN, one assert each, and cover every listed case (setting-off, threading, absent-edge, throw-fallback, warn-once, cache-reuse). None tautological.

## #QUESTION_FOR_HUMAN
None.
