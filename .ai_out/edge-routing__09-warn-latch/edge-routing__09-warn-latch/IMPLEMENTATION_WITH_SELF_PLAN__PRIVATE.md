# IMPLEMENTATION_WITH_SELF_PLAN__PRIVATE — edge-routing__09-warn-latch

## State: COMPLETE

All plan steps done, check + test green, committed on `edge-routing__09-warn-latch`,
working tree clean. Nothing pending except (optionally) closing the ticket and adding a
`change_log` entry — deliberately left to TOP_LEVEL_AGENT, matching how __07/__08 were
closed (`docs(edge-routing__08): close the ticket with change log…`).

## What I actually did

Boolean latch `routingFailureWarned` → `Set<string> warnedRoutingFailures`, keyed by
`` `${name}: ${message}` `` for `Error`, else guarded `String(error)`. Two new private
members on `GraphViewController`: `warnRoutingFailureOncePerSignature(error)` and
`static routingFailureSignature(error)`. One new module constant
`UNSTRINGIFIABLE_FAILURE_SIGNATURE`. Two stale "warn ONCE" doc sites updated
(field comment, `resolveRoutes()` jsdoc).

Test side: added `NonErrorThrow` wrapper class + `FakeRouterResponse` union so
`FakeEdgeRouter` can throw a non-`Error`; 5 new BDD tests.

## Verified claims (do not re-litigate)

- Exploration line numbers (:100, :244-245, :301) were accurate against the live tree.
- The pre-existing `"…warns exactly once"` test at old :609 passes UNCHANGED under the
  new design (same Error instance → same signature). The Explore agent's prediction that
  it needed changing was wrong. Confirmed by a verbose targeted vitest run.
- Full suite: 68 files / 920 tests passed. `tsc -noEmit` clean.

## Decisions with rationale (if challenged)

- **No cap on the signature Set.** Bounded-in-practice cardinality; controller-lifetime
  scope; a cap adds an untested branch or a heavy 21-failure test. Documented in PUBLIC.md.
- **Rejected debug-level-for-repeats.** `console.debug` is off by default in Obsidian, so
  it yields the same practical visibility as dedup while carrying two log paths.
- **`String(error)` wrapped in try/catch.** Prevents the failure reporter from throwing
  (null-prototype / hostile `toString`) and thereby failing the rebuild.
- **No shared `warnOnce` utility.** Single caller; grep confirmed no existing dedup helper
  anywhere in `src/`. Promote only on a second caller.

## If resuming

Nothing to resume. If a reviewer pushes back on the no-cap choice, the minimal change is:
add `MAX_WARNED_ROUTING_FAILURE_SIGNATURES` next to `UNSTRINGIFIABLE_FAILURE_SIGNATURE` and
an early `if (this.warnedRoutingFailures.size >= CAP) return;` in
`warnRoutingFailureOncePerSignature` — plus a test that loops distinct errors past the cap
(and the doc comments must then say the suppression is real, not silent-by-accident).
