# ROOT_CAUSE_REVIEWER — private notes (rehydration)

Ticket `edge-routing-a-throw-inside-route-kills-the-wasm-module-for-the-rest-of-the-session.md`
(`nid_oy3vas85xhr34n2dby1mvows4_e`). Branch `edge-routing__07-wasm-abort`.
Deliverable written: `ROOT_CAUSE_REVIEW__PUBLIC.md` (verdict **APPROVED-WITH-CONDITIONS**).

## State on exit

- `git status` clean; `git diff -- src/` empty. My experimental patch to
  `AvoidArena.dispose()` is **reverted** and the RED test at `src/view/edgeRouting.test.ts:675`
  is **RED again** (`.tmp/rcr-3-red-again.txt`: `Tests 1 failed | 25 passed (26)`).
- `.tmp/` artifacts (untracked, gitignored, safe to delete):
  - `rcr-1-red.txt` — unpatched baseline, 8212 `Aborted(` lines.
  - `rcr-2-green.txt` — patched, `26 passed`, `abortlines=0`.
  - `rcr-3-red-again.txt` — post-revert RED.
  - `rcr-probe.mjs` — my scenario probe (one scenario per process, real libavoid node build).
  - `rcr-s-<scenario>.txt` — one output file per scenario.

## What I did (so a fresh reviewer need not redo it)

1. Applied the proposed 2-line flush to `dispose()` myself → RED test goes GREEN, 0 aborts.
   Reverted. Confirmed reverting restores RED (the test is a real gate).
2. Wrote `.tmp/rcr-probe.mjs` mirroring production allocation order (Point×2 → Rectangle →
   ShapeRef → `ShapeConnectionPin(ConnDirAll).setExclusive(false)` = the NOTE path) with a
   `dispose(router, owned, flush)` that models the patch, plus a `moduleAlive()` post-check.
3. Verified §4 reachability by grep: sole `.route(` call site is `GraphViewController.ts:270`;
   input from `extractEdgeRoutingInput` at `:254`, only signature+cache between; `routeCache`
   stores results, never inputs.

## The one thing that matters — my differentiating finding

FIND_ROOT_CAUSE §5 claims **"No second failure mode was found"** and "the module was already dead
one line earlier — status quo, no regression". **False.** Measured:

```
1shape-nan-noflush  -> module ALIVE, our Error survives      (today's behaviour)
1shape-nan-flush    -> Aborted(ang >= 0, geometry.cpp,635), module DEAD, Error replaced
```

i.e. with ONE obstacle carrying non-finite coords and an in-window throw, the teardown flush
converts a recoverable failure into a session kill. The investigator tested NaN (exp I/P) and
tested the flush (F/G/D/M/H/N) but never crossed them **below the 2-pin abort threshold**.
Above the threshold (`2shape-nan-noflush`) the no-flush teardown already aborts with
`visGraph.size() == 0`, so there the fix strictly improves things.

Doubly gated (needs unreachable `:414` throw + NaN + <2 pins), so it does **not** block the fix.
It DOES mean: the honest invariant is *"flushing is the only teardown libavoid offers"*, not
*"flushing is always safe"*. Conditions 2/3/4 in the PUBLIC doc exist to keep that overstatement
out of the codebase and to link the finiteness ticket `nid_a7uwpxayt6w5vdnw8ogwskwvh_e` as the
precondition that closes the residual.

## Positions I checked and would defend

- `a′` conditional flush does NOT avoid my regression (shapes were registered, no tx ran → it
  flushes too). `try`/`catch` around the flush buys nothing (`destroy(router)` throws identically
  post-abort — see `aborting-pass-*`). Both rejections stand, now on measured grounds.
- Ticket option 2 would incidentally dodge my regression for the `:414` trigger only
  (`0shape-flush` is clean) — not enough to promote it over the class-wide fix.
- Perf is a non-issue: teardown flush 0.007 ms vs a 305.7 ms pass at 100 shapes/300 edges; the
  ~197 ms error-path cost is on an unreachable, already-failing path. 100/292 is the repo's own
  documented dense fixture (`EDGE_ROUTING_CROSSING_PENALTY_PX` comment), so the scale is honest.
- `:414` stays. `extractEdgeRoutingInput`'s filter is total across every node-skip branch.

## If challenged

The single most important literal to re-run:
`node .tmp/rcr-probe.mjs 1shape-nan-noflush` vs `node .tmp/rcr-probe.mjs 1shape-nan-flush`
(redirect — aborts flood stderr).
