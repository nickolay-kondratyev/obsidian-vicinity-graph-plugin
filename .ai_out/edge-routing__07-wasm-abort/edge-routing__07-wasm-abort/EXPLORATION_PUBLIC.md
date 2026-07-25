# EXPLORATION findings — edge-routing__07-wasm-abort

Produced by the EXPLORE stage (read-only agent; content persisted by TOP_LEVEL_AGENT).
Shared context for REPRODUCE / FIND_ROOT_CAUSE / ROOT_CAUSE_REVIEW / IMPLEMENTATION.

## 1. `src/view/edgeRouting.ts` — map

- `AvoidArena` (302–364): owns leaf objects it allocates (`Point`, `Rectangle`, `ConnEnd` — pushed into
  `owned`) plus the `router` reference. Docstring (288–298, class doc 309–319) states the **ownership
  gotcha**: the `Router` owns `ShapeRef`/`ConnRef`/`ShapeConnectionPin` and frees them itself on
  `destroy(router)`; destroying them ourselves double-frees → heap corruption/abort.
  `arena.shape()` (345–352) creates `Point`×2 + `Rectangle` (tracked) and a `ShapeRef` (NOT tracked —
  router-owned). `registerPinsForShape` (263–300) creates `ShapeConnectionPin`s, also never tracked.
- `AvoidArena.dispose()` (354–363):

```ts
dispose(): void {
    for (const obj of this.owned) { this.avoid.destroy(obj); }
    this.owned.length = 0;
    if (this.router !== null) {
        this.avoid.destroy(this.router); // frees the ShapeRefs/ConnRefs/pins it owns
        this.router = null;
    }
}
```

  Unconditional: destroys the router regardless of whether `processTransaction()` ever ran.

- `LibavoidEdgeRouter.route()` (385–430), the critical window:

```ts
const arena = new AvoidArena(avoid);
const router = arena.newRouter();
try {
    // ...routing parameters...
    for (const obstacle of input.obstacles) {              // ~400: FIRST shape enters the router
        const shape = arena.shape(router, rectOf(obstacle));
        registerPinsForShape(avoid, shape, obstacle.kind);
        shapeById.set(obstacle.id, shape);
    }
    for (const edge of input.edges) {
        const sourceShape = shapeById.get(edge.sourceId);
        const targetShape = shapeById.get(edge.targetId);
        if (sourceShape === undefined || targetShape === undefined) {
            // Contract violation: extraction guarantees an obstacle per endpoint.
            // Throwing surfaces the single pass-level fallback (no silent per-edge skip).
            throw new Error(`edge ${edge.id} references an obstacle with no registered shape`); // 414
        }
        // ...connEnd / new avoid.ConnRef(router, src, dst)...     // 418
    }
    router.processTransaction();                            // 421 — the ONLY call
    // ...readRoute per connector...
} finally {
    arena.dispose();                                        // 428 — ALWAYS runs, even mid-registration
}
```

- **The bug**: if `input.obstacles` is non-empty (≥1 `ShapeRef` in the router's pending visibility graph)
  and the throw at 414 fires before `processTransaction()` (421), `finally` still calls
  `arena.dispose()` → `avoid.destroy(router)` with a non-empty pending visGraph. Native
  `~Router()` asserts `visGraph.size() == 0` (router.cpp:143) → Emscripten **abort**, not a catchable
  exception.
- Line 414 is the ONLY explicit `throw` in `edgeRouting.ts`/`libavoidLoader.ts`.
- `readRoute` (366–374), `rectOf` (433–439): pure, no throw paths.

## 2. `src/view/libavoidLoader.ts` — map

```ts
let cached: Promise<Avoid> | null = null;

export function loadAvoid(): Promise<Avoid> {
    if (cached === null) {
        const attempt = initAvoid();
        cached = attempt;
        attempt.catch(() => { if (cached === attempt) { cached = null; } });
    }
    return cached;
}

async function initAvoid(): Promise<Avoid> {
    await AvoidLib.load(WASM_DATA_URL);
    return AvoidLib.getInstance() as unknown as Avoid;
}
```

- Docstring (112–127): only a *successful* instance is memoised; a rejected init promise is cleared so a
  later call retries. That retry covers a transient **init** failure only — never a post-init abort.
- No Emscripten `onAbort` hook, no `ABORT` flag inspection, no module options beyond the data URL.

**Decisive finding** (verified in `node_modules/libavoid-js/dist/index-node.mjs`, v0.4.5): `AvoidLib` is
itself a module-scope memoising singleton one level *below* our cache:

```js
var yt = Ne => ({
  avoidLib: void 0,
  async load(_e = void 0) {
    if (this.avoidLib) console.log("Avoid library is already initialized");
    else { let t = ...; this.avoidLib = await Ne({ locateFile: t }); }
  },
  getInstance() { if (!this.avoidLib) throw new Error("..."); return this.avoidLib; }
});
var Ni = yt(gt); export { Ni as AvoidLib };
```

> **Resetting our own `cached` cannot recover a post-abort module.** Even if `loadAvoid()` stopped
> memoising, `AvoidLib.load()` sees its own already-set `avoidLib` and returns the same poisoned
> instance. The ticket's "stop memoising a dead instance" idea is **not viable as same-session
> recovery** with libavoid-js as shipped. (UNVERIFIED whether a future version changes this.)

Abort mechanism, same file:

```js
function T(e) {
  throw t.onAbort && t.onAbort(e), e = "Aborted(" + e + ")", M(e), re = !0, ue && st(),
        e = new WebAssembly.RuntimeError(e), ie(e), e;
}
```

No `onAbort` is configured, so it logs, sets an internal dead flag (`re = !0`), and throws a
`WebAssembly.RuntimeError`. Genuine Emscripten `abort()`, escalated from the native assertion — not a
C++ exception the WebIDL binder converts to a catchable JS `Error`. Exact bytecode-level reason the
instance stays dead is UNVERIFIED, but the deadness is empirically reproduced (ticket + edge-routing__06
review §7.5).

## 3. Callers

- `LibavoidEdgeRouter` instantiated once: `src/view/VicinityGraphView.tsx:59`, injected into
  `GraphViewController` (`src/view/GraphViewController.ts:107`).
- Sole `.route()` call site: `GraphViewController.ts:270` inside `resolveRoutes()` (247–308):

```ts
try {
    const routes = await this.edgeRouter.route(input);
    // ...clip, staleness check, cache...
} catch (error: unknown) {
    if (!this.routingFailureWarned) {
        this.routingFailureWarned = true;
        console.warn("vicinity-graph: edge routing failed; rendering straight edges", error);
    }
    this.routeCache = null;
    return EMPTY_ROUTES;
}
```

  `EMPTY_ROUTES` (comment at :71) is the single documented pass-level fallback. `routingFailureWarned`
  is per-controller-instance (warn once per view).
- **Critical gap**: this catch handles a *normal* throw correctly for that rebuild. The bug is one layer
  down — the wasm abort corrupts the shared singleton `Avoid`, so every *subsequent* rebuild also fails.
  The catch's recovery is cosmetic in that scenario.
- `GraphViewController.test.ts:114-128, 598-621` covers the catch/fallback/warn-once with a
  `FakeEdgeRouter` throwing a plain `Error` — never touches real wasm, cannot exercise the abort.
- No caller of `loadAvoid()` outside `edgeRouting.ts:390` (sole dynamic-import site).

## 4. `src/view/edgeRouting.test.ts` — structure (644 lines, BDD WHEN/THEN)

Four describes: `extractEdgeRoutingInput` (pure), clearance/penalty invariants (pure),
`BOUNDARY_PIN_SPECS` (pure), and `LibavoidEdgeRouter with real wasm` (248–644) — the only wasm block.

- `vi.mock("./libavoidLoader", () => ({ loadAvoid: loadAvoidMock }))` (:25) replaces the browser
  data-URL loader; `beforeAll` (253–266) loads the **real** Node build off disk and resolves the mock
  with it:

```ts
const require = createRequire(import.meta.url);
const LIBAVOID_NODE_BUILD = require.resolve("libavoid-js");
beforeAll(async () => {
    try {
        const libavoid = await import(pathToFileURL(LIBAVOID_NODE_BUILD).href);
        await libavoid.AvoidLib.load();
        avoid = libavoid.AvoidLib.getInstance();
        loadAvoidMock.mockResolvedValue(avoid);
    } catch { avoid = null; }
});
```

  Real wasm engine, Node build instead of the shipped base64 data URL. `requireWasm(ctx)` (274–280)
  uses `ctx.skip(...)` when wasm failed to load (never silently passes).
- **Same `avoid` instance shared across ALL tests in the file** — `beforeAll` once per file, no
  afterEach/afterAll resetting wasm state. Each `route()` builds a fresh JS-level `AvoidArena`/`Router`
  but from the one memoised binding object. So an abort in one test poisons every later test in the
  file — the file is already a ready-made reproduction harness.
- **No existing test exercises the missing-obstacle throw path.**
- `freshPinExclusivity` (458–479) already documents and applies the safe pattern:

```
 * ...The pin is ROUTER-owned (see AvoidArena's OWNERSHIP GOTCHA), so only the
 * Points/Rectangle are destroyed here and the Router last; `processTransaction()`
 * flushes the pending shape add first, because destroying a Router with unprocessed
 * work is a known wasm-abort path (ticket `edge-routing-a-throw-inside-route-kills-…`).
```

  In-repo precedent for ticket design option 1, just not applied inside `AvoidArena.dispose()`.

## 5. Vitest config / wasm resolution

- `vitest.config.ts` sets only `test.include: ["src/**/*.test.{ts,tsx}"]` → **default `node`
  environment**. Hence the explicit `require.resolve("libavoid-js")` + file:// dynamic import (a bare
  import resolves to the Chromium-only browser build, which aborts under Node — comment at :256).
- `libavoid-js` exports map: node → `./dist/index-node.mjs`; the Node build reads
  `dist/libavoid.wasm` (485460 bytes) off disk, no data URL / fetch.
- **A same-process "second `route()` still works" test is feasible** inside the existing real-wasm
  describe block via the already-wired `loadAvoidMock`. No new test infrastructure needed.
- `npm run check` = `tsc -noEmit`; `npm test` = `vitest run`.

## 6. Prior art

- `.ai_out/edge-routing__06/main/IMPLEMENTATION_REVIEW__PUBLIC.md` §7.5 (183–194): same bug, marked
  pre-existing, same reproduced abort message, same two candidate fixes, same real-wasm regression-test
  requirement — the word-for-word precursor to the ticket.
- Ticket `## Design` restates those two options + the `loadAvoid()` memoisation question (which §2 shows
  is insufficient on its own).
- `docs-internal/architecture-map.md` 49–56: `edgeRouting.ts`/`libavoidLoader.ts` are the sanctioned
  home for libavoid-js/WASM routing; 60–66 explain the esbuild base64 wasm inlining (`loader['.wasm'] =
  'base64'`, virtual `libavoid-wasm` import) — which is *why* `route()` dynamically imports
  `./libavoidLoader` (comment at 387–390): importing `edgeRouting.ts` for pure extraction/testing must
  not pull in the wasm loader, which vitest cannot resolve directly.
- Layering (architecture-map 7–20): the whole fix stays inside `src/view/` regardless of option chosen.
- `.ai_out/edge-routing__00-wasm-spike/.../EXPLORATION_PUBLIC.md:56`: "Router destroy tears down
  registered shapes/conns" — the spike's 100× create/destroy loop only ever ran the happy path, so the
  abort path was never exercised then.
- `docs-internal/plan/high-level-plan.md`: no edge-routing/libavoid matches found (UNVERIFIED whether
  covered under other terminology).

## 7. Same-class failure surface (beyond line 414)

**Structural risk**: *any* exception raised after the first `arena.shape(router, ...)` (400) and before
`processTransaction()` succeeds (421) hits the same `finally { arena.dispose() }` → abort. Line 414 is
the only proven trigger; unexercised (UNVERIFIED throw-ability) candidates in the same window:

- `registerPinsForShape` (263–300) — `new avoid.ShapeConnectionPin(...)` native validation failure.
- `arena.connEnd(...)` (339–343) and `new avoid.ConnRef(router, src, dst)` (418).
- Degenerate obstacle rects (zero/negative `widthPx`/`heightPx`) — not guarded in
  `extractEdgeRoutingInput`; libavoid behavior UNVERIFIED.

**Central trade-off for ROOT_CAUSE**: option 1 (processTransaction-before-destroy when shapes were
registered) defends the *whole class* of "any throw once ≥1 shape registered"; option 2 (resolve all
endpoints before creating any shape) is "more root cause" for the specific missing-obstacle case (no
partially-built router can exist for that input) but closes only that one hole.

- `AvoidArena.dispose()` has no defensive guard and no state tracking "did a transaction run" / "were
  shapes added" — any option-1 fix must add exactly that, without breaking the never-track-router-owned
  invariant.
- No other production file constructs an `Avoid.Router` or calls libavoid bindings.
- `src/view/edgeGeometry.ts` + `clipRoutesToObstacles` operate on plain JS points — no lifecycle risk.

## Constraints any fix MUST respect

1. **Never `destroy()` router-owned objects** (`ShapeRef`, `ConnRef`, `ShapeConnectionPin`); only
   `Point`, `Rectangle`, `ConnEnd` may enter `AvoidArena.owned` (edgeRouting.ts:288-298; also a ticket
   acceptance criterion).
2. **`processTransaction()` must run before `destroy(router)` whenever ≥1 shape was added** — the
   precedented pattern at `edgeRouting.test.ts:465-479`; exactly what `visGraph.size() == 0` checks.
3. **Preserve the single pass-level fallback contract**: a contract violation must still surface a
   signal that `resolveRoutes()`'s catch turns into `EMPTY_ROUTES` + one warning. No silent per-edge
   skip (comment at 412–413); no silent success with a bogus router state.
4. **Do not rely on resetting `libavoidLoader.ts`'s `cached`** as recovery — see §2. The fix must
   *prevent* the abort.
5. **Real-wasm regression test**: inside the existing real-wasm describe block; route an input with a
   missing-obstacle edge, then assert a SECOND `route()` still succeeds; RED before the fix. NOTE for
   REPRODUCE: an uncaught Emscripten abort inside a Vitest worker may crash the worker rather than
   cleanly failing one test — confirming exact behavior is REPRODUCE's job.
6. **Layering**: fix stays inside `src/view/`.
7. `npm run check` and `npm test` green.
