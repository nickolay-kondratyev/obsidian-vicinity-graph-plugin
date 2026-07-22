# Phase 0 spike — libavoid-js WASM — IMPLEMENTATION ITERATION (convergence pass)

Iteration agent: IMPLEMENTATION_WITH_SELF_PLAN (iteration phase).
Input: `IMPLEMENTATION_REVIEW__PUBLIC.md` (verdict READY TO CLOSE — 0 BLOCKING, 2 IMPORTANT, 5 NIT).
Scope: convergence only. One code file touched: `src/view/libavoidLoader.ts`.

## Convergence statement

All essential feedback is addressed-or-rejected. The one in-scope IMPORTANT code item (I2)
is fixed with a deliberate, documented decision. I1 is orchestrator-owned (ticket bookkeeping),
not mine. All 5 NITs triaged: none warrant a code change in throwaway/spike scope. No blocking
issues remain. Tests green: `npm run check` exit 0, `vitest run` 616 passed / 54 files (612
pre-existing + 4 spike — unchanged from the reviewed baseline).

## I2 — ADDRESSED (the only in-scope IMPORTANT code item)

**Decision: reset-on-failure (retry allowed). Memoize only a SUCCESSFUL instance.**

**File:** `src/view/libavoidLoader.ts:89-118` (`loadAvoid`).

**Diff summary:** Previously `loadAvoid` assigned `cached = initAvoid()` unconditionally on
first call, so a rejected init promise was retained for the whole process lifetime — every
later call re-threw the same failure with no retry. Now: the in-flight promise is still
assigned synchronously (concurrent callers share one init — no double-load race preserved),
but a `.catch` side-effect handler clears the cached slot **iff** the failed attempt is still
the cached one (`if (cached === attempt) cached = null`), so a subsequent call gets a fresh
attempt. The public API is byte-identical (`loadAvoid(): Promise<Avoid>`, lazy, success-cached
singleton). The failure is NOT swallowed — the rejecting `attempt` promise is what we return,
so THIS caller still sees the error (routing pass falls back to straight edges for this pass);
the `.catch` only handles the reset side-effect and never masks the rejection.

**WHY (also at the code site):** caching a rejection would lock the entire session into
straight edges after a single transient init hiccup (e.g. a one-off Chromium/Electron failure
instantiating the `data:` wasm) with no recovery short of a plugin reload. Retry-on-failure is
the safer contract for Phase 1's `LibavoidEdgeRouter` to inherit. The race-guard (`cached ===
attempt`) ensures a newer successful/in-flight attempt is never clobbered by a stale rejection.

**Verification reasoning:** the change touches ONLY the failure-caching branch. `initAvoid`
(the actual wasm load path) and the success-caching behavior are unchanged. The e2e and vitest
exercise the SUCCESS path, which is unaffected — so re-running the e2e is not required to keep
the offline-load proof honest. vitest + check re-run (both green) is sufficient and was done.

## I1 — NOT MINE (orchestrator-owned)

Acceptance criterion 5 (`ticket add-note`) is ticket bookkeeping the orchestrator handles per
my task brief. No action taken here. The finding substance already lives in the `.ai_out`
PUBLIC docs; only the literal "recorded on the ticket" wording is outstanding.

## NIT triage

| NIT | Summary | Decision | Rationale |
|-----|---------|----------|-----------|
| N1 | Leak-safe `AvoidArena` lives in throwaway spike; should be promoted to Phase 1 | REJECT (already tracked) | Not a Phase-0 code change. Already recorded as a Phase-1 follow-up in PRIVATE memory ("promote AvoidArena into LibavoidEdgeRouter"). Promoting it now would pull `edgeRouting.ts` (Phase 1) into scope — explicitly forbidden. |
| N2 | `loadPath: "data-url"` hardcoded → e2e assertion is tautological | REJECT (spike, throwaway) | The value is accurate (only one path exists) and the assertion is honest, just low-weight. The e2e is THROWAWAY. Adding real path-detection is YAGNI for a single-path loader. |
| N3 | Obstacle-avoidance checked on polyline vertices, not segments | REJECT (spike proxy) | Reviewer classifies it as an acceptable proxy, not a defect. With `shapeBufferDistance` clearance + the `pointCount>2` co-assertion it is sufficient for a de-risk spike. Segment-intersection testing is gold-plating throwaway test code. |
| N4 | `Avoid` index signature `readonly [key: string]: unknown` weakens type-safety | REJECT (pragmatic, untyped lib) | libavoid-js ships no usable types (untyped `declare module`); the index signature covers ~300 flat enum constants we do not name. Narrowing further is high-effort, low-value, and already honestly documented at the code site. |
| N5 | `loadAvoid` is a module-level free function (CLAUDE.md disfavors) | REJECT (acceptable module-singleton; Phase-1 DIP concern) | It is an acceptable module-singleton. Wrapping it behind an injected interface for DIP is a legitimate Phase-1 `LibavoidEdgeRouter` design decision, not a Phase-0 spike change. Doing it now would expand the production surface prematurely. |

Net: 0 NIT code changes. All rejections are scope/YAGNI-based, consistent with "do not
gold-plate throwaway code."

## Verification results (actual)

- `npm run check` (tsc): **exit 0** — clean. Log: `.tmp/check-iter.log`.
- `vitest run` (full): **616 passed / 54 files**, exit 0 (612 pre-existing + 4 spike — no
  regressions vs. reviewed baseline). Log: `.tmp/vitest-iter.log`.
- e2e: NOT re-run. Justified — the fix touches only the failure-caching branch; the wasm load
  path and success-caching are unchanged, so the offline-load proof is unaffected. (Success
  path is exercised by vitest + would be by the e2e; nothing in that path changed.)

## Scope discipline

Only `src/view/libavoidLoader.ts` changed (plus these two `.ai_out` docs). No
GraphViewController / flowMapping / edgeGeometry / VicinityEdge / snapshot / settings touched.
No esbuild/bundling/wasm-embed changes. The `AvoidArena` memory-safety pattern (never destroy
router-owned ShapeRef/ConnRef/pins) is untouched and intact.
