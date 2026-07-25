# ROOT CAUSE — edge-routing__07-wasm-abort

Produced by FIND_ROOT_CAUSE. Input to ROOT_CAUSE_REVIEW and IMPLEMENTATION.
Builds on `EXPLORATION_PUBLIC.md` and `REPRODUCE__PUBLIC.md` (both in this dir).

**Verdict in one line:** `AvoidArena.dispose()` destroys a `Router` that still holds an
**unprocessed transaction**, and libavoid's `~Router()` only unlinks a shape's visibility
data when the shape is *active* — which it becomes only in `processTransaction()` — so the
eagerly-created pin visibility edges survive to `COLA_ASSERT(visGraph.size() == 0)` and
Emscripten aborts, killing the load-once wasm module for the session.

---

## 1. The root-cause chain, from first principles

Every link below is quoted from the actual adaptagrams source (github `mjwybrow/adaptagrams`,
the code libavoid-js 0.4.5 compiles) or measured against the shipped wasm.

**(1) Registering an obstacle only QUEUES work.** `new avoid.ShapeRef(router, rect)` appends a
`ShapeAdd` action to `Router::actionList`; the shape stays `m_active == false` until a
transaction runs. `Obstacle`'s constructor initialiser list is explicit: `m_active(false)`.

**(2) Connection pins, by contrast, touch the visibility graph IMMEDIATELY.**
`ShapeConnectionPin`'s constructor → `commonInitForShapeConnection()`:

```cpp
VertID id(m_shape->id(), kShapeConnectionPin,
        VertID::PROP_ConnPoint | VertID::PROP_ConnectionPin);
m_vertex = new VertInf(m_router, id, this->position());
m_vertex->visDirections = this->directions();
...
if (m_router->m_allows_polyline_routing)
{
    vertexVisibility(m_vertex, nullptr, true, true);   // <-- EAGER, at construction
}
```

We construct the `Router` with `avoid.PolyLineRouting`, so `m_allows_polyline_routing` is on and
this branch always runs. `vertexVisibility` creates `EdgeInf`s (visibility edges) into
`Router::visGraph` **before any transaction**. This is the load-bearing fact the exploration
doc did not have.

**(3) So `visGraph` is non-empty from the SECOND pin onward.** A visibility edge needs two
endpoints. With one pin vertex there is nothing for it to see (the shape's own corner vertices
are not in the router's vertex list yet — they are added on activation), so `visGraph.size()==0`;
with a second pin vertex, at least one `EdgeInf` exists. That is exactly the ≥2-pin threshold
REPRODUCE measured, and I re-measured it (§3, experiment K: 1 pin clean, 2 and 3 pins abort).
The step "corner vertices only enter the graph on activation" is INFERRED from the measurement +
`m_active(false)`; I did not read `Obstacle::makeActive()`. Marked **UNVERIFIED**, but nothing in
the recommendation depends on the pin count — see §5.

**(4) `~Router()` only cleans up ACTIVE obstacles:**

```cpp
    ObstacleList::iterator obstacle =  m_obstacles.begin();
    while (obstacle != m_obstacles.end())
    {
        Obstacle *obstaclePtr = *obstacle;
        ...
        if (obstaclePtr->isActive())          // <-- FALSE for a queued-but-unprocessed shape
        {
            obstaclePtr->removeFromGraph();   // <-- the unlink that empties visGraph
            obstaclePtr->makeInactive();
        }
        delete obstaclePtr;
        obstacle = m_obstacles.begin();
    }
    ...
    COLA_ASSERT(m_obstacles.size() == 0);
    COLA_ASSERT(connRefs.size() == 0);
    COLA_ASSERT(visGraph.size() == 0);        // <-- router.cpp:143, the assert we hit
```

and `~Obstacle()` then deletes the shape's own `VertInf`s **raw**, without unlinking their edges:

```cpp
Obstacle::~Obstacle()
{
    COLA_ASSERT(m_active == false);
    VertInf *it = m_first_vert;
    do { VertInf *tmp = it; it = it->shNext; delete tmp; } while (it != m_first_vert);
    ...
    while (!m_connection_pins.empty()) { delete *(m_connection_pins.begin()); }
}
```

**(5) The invariant being violated is therefore:**

> A `Router` may only be destroyed once every queued action has been processed — i.e.
> `processTransaction()` must have run since the last `addShape`/`ConnRef`. Destroying a
> Router with a pending transaction leaves its eagerly-built pin visibility edges orphaned,
> and the destructor asserts on them.

**(6) The violating line** is `src/view/edgeRouting.ts:360` — `this.avoid.destroy(this.router)`
inside `AvoidArena.dispose()` — reached from `src/view/edgeRouting.ts:428`
(`finally { arena.dispose(); }`) whenever control leaves the `try` block before
`router.processTransaction()` at `:421` has run.

**(7) Why it is fatal rather than a failed pass.** `COLA_ASSERT` → Emscripten `abort()` →
`WebAssembly.RuntimeError` + a permanent dead flag on the module. Recovery is impossible
in-process: `libavoid-js`'s own `AvoidLib` is a load-once singleton one level *below* our
`loadAvoid()` memo — verified myself in `node_modules/libavoid-js/dist/index-node.mjs`:

```js
avoidLib:void 0,async load(_e=void 0){if(this.avoidLib)console.log("Avoid library is already initialized");else{...}}
getInstance(){if(!this.avoidLib)throw new Error("Avoid library should be initialized before using");return this.avoidLib}
```

A second `AvoidLib.load()` is a no-op returning the SAME poisoned instance. **The ticket's third
idea ("stop memoising an aborted instance") is dead on arrival** — nothing at the loader layer
can recover; the abort must be *prevented*.

**(8) The class of trigger, not the instance.** The window is "any control-flow exit between the
first `ShapeConnectionPin` construction (`:404`) and `processTransaction()` returning (`:421`)".
The `throw` at `:414` is merely the one we can reach synthetically. Another live JS-throw source
in that window is the WebIDL glue itself — experiment J: a wrong-arity/typed binding call throws a
catchable `ReferenceError: _emscripten_bind_Point_Point_1 is not defined`.

## 2. Is the specific trigger REACHABLE in production? (ticket option (c) — determined)

**No.** `extractEdgeRoutingInput` (`src/view/edgeRouting.ts:154-160`) already enforces the exact
contract that `:414` re-checks:

```ts
for (const edge of input.edges) {
    if (!obstacleIds.has(edge.source) || !obstacleIds.has(edge.target)) { continue; }
    edges.push(...);
}
```

`obstacleIds` is populated only for obstacles actually emitted, and the sole production call site
(`GraphViewController.resolveRoutes`, `src/view/GraphViewController.ts:254-270`) passes that
extraction output straight into `route()` with nothing in between. So **option (c) is already
implemented**: the missing-obstacle contract is validated at its source, and `:414` is unreachable
defensive code today.

**This changes what "root cause" means for this ticket.** The bug is NOT "we throw on bad input".
The bug is that `AvoidArena`'s teardown protocol is only valid on the happy path, so *any* future
or unforeseen exit from that window is a session-killer. A fix aimed at the missing-obstacle case
(ticket option 2) would harden a path that cannot fire while leaving the actual defect in place.

Two consequences for scope:

- Keep the `:414` throw. It is the honest statement of the seam's precondition and costs nothing.
- A *different* input-validation gap IS reachable and IS fatal: non-finite coordinates abort inside
  `processTransaction()` itself (`ang >= 0`, geometry.cpp:635 — experiments I/P). No teardown fix
  helps there. Filed separately as ticket
  `_tickets/edge-routing-non-finite-obstacle-coordinates-abort-the-wasm-module-inside-processtransaction.md`
  (`nid_a7uwpxayt6w5vdnw8ogwskwvh_e`). **Out of scope here** — different failure class, and its
  reachability from d3-force/elk is UNVERIFIED.

## 3. Experiments

Harness `.tmp/rc-probe.mjs` (throwaway, untracked): each scenario in its **own node process**
against the real libavoid node build, mirroring production allocation order (Point×2 → Rectangle →
ShapeRef → `ShapeConnectionPin.setExclusive(false)`), then a full happy-path route to prove the
module is still alive. Outputs in `.tmp/rc/`.

| # | Scenario | Decisive literal output |
|---|---|---|
| A | production teardown, **no** flush, 2 shapes/2 pins | `Aborted(Assertion failed: visGraph.size() == 0, at: ./adaptagrams/cola/libavoid/router.cpp,143,~Router)` — exit 1, 8135 abort lines |
| B | **flush first**, then free leaves, then destroy | `STEP_OK=[processTransaction() on shapes-only router returned]` · `MODULE_ALIVE=[yes] follow_up_route_points=[4]` |
| C | free Points/Rectangles FIRST, then flush, then destroy | `STEP_OK=[processTransaction() after freeing owned leaves returned]` · `MODULE_ALIVE=[yes]` — ordering is **not** a hazard |
| M | free Points/Rectangles/**ConnEnds** with a ConnRef still unprocessed, then flush | `STEP_OK=[processTransaction() after freeing owned leaves returned; route=2 pts]` · `MODULE_ALIVE=[yes]` |
| D | half-built connector set (1 ConnRef, 3rd shape unconnected) + flush | `STEP_OK=[processTransaction() with a half-built connector set returned]` · `MODULE_ALIVE=[yes]` |
| E | same but **no** flush | `Aborted(… visGraph.size() == 0 …)` — the abort is not specific to the shapes-only shape of the bug |
| F | **empty** router (throw before the first shape) + unconditional flush | `STEP_OK=[processTransaction() on an EMPTY router returned]` · `MODULE_ALIVE=[yes]` |
| G | router with **no routing parameters set** + flush | `STEP_OK=[processTransaction() on a parameterless router returned]` · `MODULE_ALIVE=[yes]` |
| H | **double** flush on the happy path (small scene) | `STEP_OK=[double processTransaction returned; route=4 pts; 1st=2.97ms 2nd=0.04ms]` — route unchanged |
| N | double flush at production scale (100 shapes / 292 edges) | `STEP_OK=[scale shapes=100 edges=292 first_tx=280.2ms second_tx=0.01ms]` |
| O | cost of the flush **on the error path** at scale | `STEP_OK=[error-path flush of 100 pending shapes took 174.2ms]` |
| K | pin threshold, 1 shape | `pins=1 exit=0 aborts=0` · `pins=2 exit=1 aborts=8134` · `pins=3 exit=1 aborts=8135` |
| L | alternative teardown: `deleteShape()` then flush | `Aborted(Assertion failed: find(actionList.begin(), actionList.end(), ActionInfo(ShapeAdd, shape)) == actionList.end(), at: ./adaptagrams/cola/libavoid/router.cpp,287,deleteShape)` |
| I | degenerate geometry | `zero-size` → `accepted`; `negative-size` → `accepted`; `NaN` → `Aborted(Assertion failed: ang >= 0, at: ./adaptagrams/cola/libavoid/geometry.cpp,635,rotationalAngle)` |
| P | `Infinity` geometry | same `ang >= 0` abort |
| J | wrong JS arg types into the binding | `STEP_OK=[Point(bad args) outcome=[THREW ReferenceError: _emscripten_bind_Point_Point_1 is not defined]]` (catchable, module survives) |

### Production-path validation of the leading candidate

Temporary patch to `AvoidArena.dispose()` (**reverted; `git status` clean**):

```ts
dispose(): void {
    if (this.router !== null) { this.router.processTransaction(); }   // EXPERIMENT
    for (const obj of this.owned) { ... }
```

- `npx vitest run src/view/edgeRouting.test.ts` → **`Test Files 1 passed (1)` / `Tests 26 passed (26)`**,
  `grep -c "Aborted("` = **0**. The RED regression test at `edgeRouting.test.ts:675` goes GREEN.
- Throwaway scratch spec (deleted) on the same patch, 2 assertions, both pass:
  1. the doomed pass rejects with **our own** `Error("edge A->missing references an obstacle with no
     registered shape")` — the diagnostic `resolveRoutes()` logs is restored;
  2. a **folder-group** scene (12 pins per shape, the production-heavy case) fails mid-pass and the
     next ordinary pass still routes.
- Same scratch spec with the patch reverted (proving the assertions bite):
  `AssertionError: expected [Function] to throw error including 'edge A->missing references an obstacl…' but got 'Maximum call stack size exceeded'`
  and `expected [Function] to throw error including 'no registered shape' but got 'program has already aborted!'`.

## 4. Candidate matrix

| # | Candidate | Fixes the whole CLASS? | Ownership-safe? | Second failure mode? | Cost |
|---|---|---|---|---|---|
| **a** | **`dispose()` flushes (`processTransaction()`) before `destroy(router)`** | **Yes** — every exit from the window (A/E/D/F/G all clean) | Yes — touches no `ShapeRef`/`ConnRef`/pin; `owned` untouched | None found: safe on empty (F), parameterless (G), half-built (D/M), already-flushed (H/N) routers | 2 lines; 0.01ms on the happy path (N), ~174ms once on a failing pass (O) |
| a′ | (a) but *conditional* on "shapes registered && no transaction ran" | Yes | Yes | Adds mutable state to `AvoidArena` that can drift out of sync with reality — a new correctness surface for **zero** measured benefit (F/H/N show the unconditional call is free) | 2 fields + branches |
| **b** | Resolve/validate every edge endpoint before registering any shape (ticket option 2) | **No** — only the `:414` throw; J-style binding throws and any future in-window throw stay fatal | Yes | No | ~6 lines |
| **c** | Validate the routing input at its source | **N/A — already done** for this contract (§2); the finiteness gap it *does* leave is a different class that (a) cannot fix | — | — | 0 (this ticket) |
| d1 | Safe teardown as a stated INVARIANT of `AvoidArena` (docstring + test), implemented by (a) | Yes | Yes | No | ≈ (a) + a comment and a focused test |
| d2 | `deleteShape()`/`deleteConnector()` everything, then flush | — | Yes | **Yes — aborts** (L): `deleteShape` asserts there is no pending `ShapeAdd` for that shape | — |
| d3 | Don't destroy the router on the error path (leak it) | Yes | Yes | Unbounded native leak across rebuilds; hides the defect | small |
| d4 | Per-`route()` wasm instance / stop sharing the memoised module | Recovery only, not prevention | — | **Impossible**: `AvoidLib` is load-once (§1.7) | — |
| d5 | Emscripten `onAbort` hook + module rebuild | Recovery only | — | Same blocker as d4 | — |

## 5. RECOMMENDATION

**Adopt (a), unconditionally, framed as (d1): `AvoidArena.dispose()` flushes the pending
transaction before destroying the Router, and that guarantee is stated as an invariant of the
type.** Concretely:

```ts
dispose(): void {
    if (this.router !== null) {
        // WHY: libavoid's ~Router() asserts visGraph.size()==0, but it only unlinks a
        // shape's visibility data when the shape is ACTIVE — activation happens in
        // processTransaction(). Pins build visibility edges EAGERLY at construction, so
        // destroying a Router with a queued transaction orphans them → wasm abort → the
        // load-once module is dead for the session. Flushing first is the only way to
        // reach a destroyable state (deleteShape() on a pending add asserts too).
        // Unconditional: a no-op flush costs 0.01ms even at 100 shapes / 292 edges, and
        // tracking "did a transaction run" would be state that can only go wrong.
        this.router.processTransaction();
    }
    for (const obj of this.owned) { this.avoid.destroy(obj); }
    ...
}
```

Placement: **before** freeing `owned`. C and M prove the reverse order also survives, so this is a
readability/robustness choice, not a correctness one — but "return the router to a destroyable
state, then free" is the order the invariant reads in.

Why this and not more:

- It fixes the **whole class** ("any exit between first pin registration and `processTransaction()`"),
  which is what actually matters, because the one trigger we can name is unreachable (§2).
- It puts the fix where the broken promise lives. `AvoidArena`'s docstring already claims it
  "frees them in a single sweep, so a pass cannot leak — or double-free — even on the throw path";
  the class simply never honoured that on the throw path. That is a **type invariant repair**,
  not a patch.
- It restores the intended failure semantics: the pass-level `Error` reaches
  `GraphViewController.resolveRoutes()`'s catch again instead of being replaced by
  `RangeError: Maximum call stack size exceeded` (§3).
- It respects every ownership rule: nothing router-owned is tracked or destroyed.
- No second failure mode was found across F/G/D/M/H/N. The only way the flush itself dies is an
  Emscripten abort *from inside the pass* (the non-finite-geometry class), and in that case the
  module was already dead one line earlier — status quo, no regression. **Do not** wrap the flush
  in a try/catch: `destroy(router)` on the next line would throw identically, so the guard would buy
  nothing and cost clarity.

Rejected, with reasons:

- **(b) / ticket option 2 — REJECTED as the fix, acceptable as nothing.** The ticket calls it "the
  more root-cause fix", but §2 shows the hole it closes cannot be reached from production, while the
  hole it leaves open (any other in-window throw) is the one that will bite. It would also duplicate
  the endpoint check that `extractEdgeRoutingInput` already owns — a DRY violation of a business rule
  across two files. If IMPLEMENTATION still wants it, it must be *in addition to* (a), never instead.
- **(a′) conditional flush — REJECTED.** Measured: unconditional costs 0.01ms at production scale.
  Tracking state to save that is over-engineering with a new drift surface.
- **d2 (`deleteShape` then flush) — REJECTED, it aborts** (L).
- **d3 (leak the router) — REJECTED**, hack.
- **d4/d5 (loader-level recovery, the ticket's third idea) — REJECTED as impossible**: `AvoidLib` is
  a load-once singleton (§1.7, verified independently of the exploration doc).

Defence-in-depth is genuinely warranted in exactly one place, and it is **not** (b): finiteness
validation of the routing input, which is a *different, reachable, unfixable-by-(a)* abort path.
It is filed as its own ticket rather than bundled here — it needs its own reachability
investigation and its own pure test, and mixing it in would blur this ticket's single behaviour.

## 6. Notes for IMPLEMENTATION

1. The committed RED test (`src/view/edgeRouting.test.ts:675`) turns GREEN with the two-line change;
   keep it LAST in the describe block (REPRODUCE §4).
2. Consider ONE additional focused test: *the doomed pass rejects with our own diagnostic error*
   (validated above; today it is replaced by `RangeError`). One behaviour per test — do not fold it
   into the survival test.
3. Reuse the WHY that already exists at `src/view/edgeRouting.test.ts:465-479` (`freshPinExclusivity`)
   rather than restating it: after the fix, that comment's rationale has a single canonical home in
   `AvoidArena.dispose()` and the test comment should point at it (DRY).
4. Update the `AvoidArena` class docstring so the teardown protocol is part of the stated contract
   next to the OWNERSHIP GOTCHA.
5. `src/view/edgeRouting.ts:411-415` (the `:414` throw) stays as is — see §2.

No open `#QUESTION_FOR_HUMAN:` items.
