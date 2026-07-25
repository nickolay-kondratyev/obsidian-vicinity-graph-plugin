# IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC — edge-routing__09-warn-latch

Ticket: `nid_eim1ftv60ybxzcucgf7rf4gk8_e`. Branch: `edge-routing__09-warn-latch`.

## Plan (as executed)

**Goal**: keep console-flood protection for routing failures, but stop swallowing
structurally DIFFERENT later failures.

1. Replace the `routingFailureWarned` boolean with a `Set<string>` of warned
   failure signatures.
2. Extract the warn into a small private method + a defensive signature derivation.
3. Update the two stale "warn ONCE" docs (field comment, `resolveRoutes()` doc).
4. Add BDD tests using the existing `FakeEdgeRouter` (extended minimally to be able
   to throw a non-`Error`).
5. `npm run check` + `npm test`.

## Design choice

**Chosen: latch per distinct failure signature** — `` `${error.name}: ${error.message}` ``
for `Error`s, `String(error)` otherwise. A signature already warned about is silent;
a new one warns exactly once.

**Rejected: debug-level logging for repeats.** It keeps every repeat in the log
(good for forensics) but pays for it with a *worse* default signal: `console.debug`
is off by default in Obsidian's console, so repeats are effectively invisible anyway
— identical observability to dedup — while the code has to carry two log paths and
two severity levels. Dedup-by-signature achieves the ticket's actual goal (a NEW
cause is never swallowed) with one code path and no severity juggling. It is also
strictly the smaller change (80/20).

**No cap on the signature set** (explicit decision, per direction). Rationale:
entries are short strings bounded by the distinct failure *messages* the routing
stack can produce, and the set lives only for the controller's (i.e. the view's)
lifetime. The only variable-cardinality message in the stack embeds an edge id
(`edgeRouting.ts` contract violation), and that throw aborts the pass at the first
bad edge, so accumulation needs many rebuilds each failing on a *different* edge —
a scenario in which the graph is comprehensively broken and every one of those
warnings is a genuinely distinct failure the user should see. A cap would buy
negligible memory back at the price of a new branch that either goes untested or
demands a heavy 21-distinct-failure test. Reviewer: this is the one judgement call
worth a second opinion.

## Files changed

### `src/view/GraphViewController.ts`

- **:74-75 (new)** — `UNSTRINGIFIABLE_FAILURE_SIGNATURE` module constant.
- **:103-109** — field `routingFailureWarned = false` → `private readonly warnedRoutingFailures = new Set<string>()`,
  with a comment that states the real (per-signature) contract.
- **:247-252** — `resolveRoutes()` doc: "warn ONCE" → "warn once per distinct failure".
- **:308-311** — catch body now calls `this.warnRoutingFailureOncePerSignature(error)`;
  `routeCache = null` / `return EMPTY_ROUTES` unchanged.
- **:314-322 (new)** — `warnRoutingFailureOncePerSignature(error: unknown)`: has → return,
  else add + `console.warn` (message text unchanged).
- **:324-340 (new)** — `private static routingFailureSignature(error: unknown)`:
  `instanceof Error` → name+message; otherwise `String(error)` wrapped in try/catch
  so a null-prototype / hostile-`toString` throwable cannot make the *reporter*
  throw and fail the rebuild.

No behavior outside the catch path was touched. `edgeRouting.ts` / `libavoidLoader.ts`
untouched.

### `src/view/GraphViewController.test.ts`

- **:110-116 (new)** — `NonErrorThrow` wrapper + `FakeRouterResponse` union, so the fake
  router can raise a non-`Error` (the wrapper is needed only because a raw value would
  be indistinguishable from a route-map response). Purely additive — existing
  `new FakeEdgeRouter(map | Error)` call sites are unchanged.
- **5 new tests** in `describe("GraphViewController edge-routing pass", …)`, after the
  existing warn-once test:
  1. `WHEN a later rebuild fails with a DIFFERENT error THEN that new failure warns too` → 2 warns.
  2. `WHEN a later rebuild fails with an equal-but-distinct Error instance THEN it stays silent (dedup is by signature, not identity)` → 1 warn.
  3. `WHEN the router throws a non-Error value THEN it still warns (no .name/.message assumed)` → 1 warn.
  4. `WHEN the router throws a non-Error value THEN edges still fall back to straight` → `routedPoints` undefined (`undefined` thrown).
- **No existing test was modified.** In particular
  `"WHEN the router throws on repeated rebuilds THEN it warns exactly once"` (~:609,
  now ~:620) stays green **unchanged** — it throws the same `Error` twice, which is the
  "repeated identical failure" criterion. The Explore agent's claim that it "will need
  to change" was wrong; verified by running it.

## Verification (verbatim)

`npm run check > .tmp/check.log 2>&1` → `CHECK_EXIT=0`

```
> vicinity-graph@0.1.1 check
> tsc -noEmit
```

`npm test > .tmp/test.log 2>&1` → `TEST_EXIT=0`

```
 Test Files  68 passed (68)
      Tests  920 passed (920)
   Duration  1.06s
```

Targeted verbose run of `src/view/GraphViewController.test.ts`: `Tests  46 passed (46)`,
with all 5 new tests and the pre-existing warn-once test shown as `✓`.

## Acceptance criteria

- Second failure with a DIFFERENT error still produces exactly one warning — test 1. ✅
- Repeated identical failure warns only once — pre-existing test (unchanged) + test 2. ✅
- BDD tests in `src/view/GraphViewController.test.ts` using `FakeEdgeRouter`. ✅
- `npm run check` + `npm test` green. ✅

## Follow-ups worth a ticket (NOT patched here)

- `EdgeRouter.route()` has no typed error channel (`src/view/edgeRouting.ts:63-66`), which
  is *why* the catch is `unknown` and the signature must be derived defensively. A typed
  failure result (`RoutingFailure` discriminant) would make the dedup key a first-class
  value instead of a string scrape. Out of scope, non-trivial seam change.
- `routingFailureSignature` is the second ad-hoc log-dedup pattern the codebase would
  need if another site ever wants it. Today it has exactly one caller — deliberately kept
  local rather than promoted to a `warnOnce` utility (YAGNI). Promote only on a 2nd caller.

## For the reviewer to scrutinise

1. The no-cap decision above.
2. The `try { String(error) } catch` — 3 lines of paranoia guarding an error handler
   from itself. Defensible, but it is the one bit of the diff that isn't strictly needed
   for the ACs.
3. Ticket close / `change_log` entry was left to TOP_LEVEL_AGENT (not done here).
