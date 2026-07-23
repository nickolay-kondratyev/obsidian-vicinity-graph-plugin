# libavoid-wasm / ShapeConnectionPin exploration

## 1. How `libavoid-wasm` is loaded/bundled

Package: `libavoid-js@0.4.5` (`package.json:23`) — the real npm package (`AvoidLib`),
shipping Emscripten glue `dist/index.js` + compiled engine `dist/libavoid.wasm`.
`libavoid-wasm` is **not** an npm package — it's a *virtual esbuild module id* invented
to get the raw `.wasm` bytes past `libavoid-js`'s `exports` map.

`esbuild.config.mjs` (9–24, 111–113):
```js
const LIBAVOID_WASM_VIRTUAL_ID = "libavoid-wasm";
const LIBAVOID_WASM_PATH = path.join(path.dirname(require.resolve("libavoid-js")), "libavoid.wasm");
const libavoidWasmPlugin = { name: "libavoid-wasm", setup(build) {
  build.onResolve({ filter: /^libavoid-wasm$/ }, () => ({ path: LIBAVOID_WASM_PATH })); } };
loader: { ".wasm": "base64" },
plugins: [generateStylesPlugin, libavoidWasmPlugin, copyToDevVaultPlugin],
```
`import libavoidWasmBase64 from "libavoid-wasm"` (`src/view/libavoidLoader.ts:2`) resolves to the
wasm on disk, inlined as base64 into `main.js`. Ambient type: `src/types/libavoidWasm.d.ts:10-14`.
**The wasm/virtual module only resolves under esbuild — NOT under vitest** (why route quality
can't be unit tested; only geometry math can).

## 2. `Avoid` interface (src/view/libavoidLoader.ts:20-48)

Hand-narrowed over `AvoidLib.getInstance()` (upstream is `[x: string]: any`):
```ts
export interface Avoid {
  readonly PolyLineRouting: number; readonly OrthogonalRouting: number;
  readonly ConnDirAll: number;
  readonly shapeBufferDistance: number; readonly segmentPenalty: number; readonly crossingPenalty: number;
  Point: new (x, y) => AvoidPoint;
  Rectangle: new (topLeft, bottomRight) => AvoidRectangle;
  Router: new (routingFlag) => AvoidRouter;
  ShapeRef: new (router, poly) => AvoidShapeRef;
  ShapeConnectionPin: new (shape, classId, xOffset, yOffset, proportional, insideOffset, visDirs) => unknown;
  ConnEnd: new (shapeOrPoint, classId?) => AvoidConnEnd;
  ConnRef: new (router, src, dst) => AvoidConnRef;
  destroy(obj): void;
  readonly [key: string]: unknown;   // ~300 enum constants reachable here
}
```

**`ShapeConnectionPin(shape, classId, xOffset, yOffset, proportional, insideOffset, visDirs)`:**
- `classId`: pin class; `ConnEnd(shape, classId)` binds only to same-shape pins with this classId.
- `xOffset/yOffset`: if `proportional=true`, fractions 0..1 of width/height (0=left/top, 0.5=centre, 1=right/bottom).
- `insideOffset`: inward nudge from boundary (currently 0).
- `visDirs`: bitmask of `ConnDirFlag` restricting approach/leave directions (currently `ConnDirAll`).

**`ConnDirFlag` constants** — only `ConnDirAll` named in the interface; others via index signature.
Confirmed present on the runtime binding (Emscripten enum exports):
`avoid.ConnDirNone / ConnDirUp / ConnDirDown / ConnDirLeft / ConnDirRight / ConnDirAll`.
**Upstream `.d.ts` ships `ConnDirFlags` as an EMPTY enum** — values exist ONLY at runtime.
`ConnDirUp/Down/Left/Right/None` must be added as named fields on the `Avoid` interface (natural
extension point) or read via `avoid["ConnDirUp"]`.

## 3. `ConnEnd` with pin class — current usage (src/view/edgeRouting.ts)

- `CENTRE_PIN_CLASS = 1` (line ~144), `PIN_CENTRE_FRACTION = 0.5` (line ~147).
- Pin registration per obstacle (~246-257):
```ts
const shape = arena.shape(router, rectOf(obstacle));
new avoid.ShapeConnectionPin(shape, CENTRE_PIN_CLASS, PIN_CENTRE_FRACTION, PIN_CENTRE_FRACTION, true, 0, avoid.ConnDirAll);
shapeById.set(obstacle.id, shape);
```
  Pin is intentionally NOT tracked/freed by AvoidArena — Router owns ShapeRefs/ConnRefs/pins and
  frees them on `destroy(router)`; explicit pin destroy = double-free (comment ~160-165).
- ConnEnd per endpoint (~269-270) via `AvoidArena.connEnd(shape, CENTRE_PIN_CLASS)` (~186-190):
```ts
const src = arena.connEnd(sourceShape, CENTRE_PIN_CLASS);
const dst = arena.connEnd(targetShape, CENTRE_PIN_CLASS);
const conn = new avoid.ConnRef(router, src, dst);
```
`AvoidArena.shape()` (~192-199) builds Rectangle from two Points + ShapeRef — natural place to loop
and register multiple pins per shape.

**Boundary-pins change**: register up to 8 pins/shape (side-midpoints (0.5,0)/(1,0.5)/(0.5,1)/(0,0.5)
+ corners (0,0)/(1,0)/(1,1)/(0,1)) keeping the SAME shared class id (rename `CENTRE_PIN_CLASS`→`PIN_CLASS`)
so any ConnEnd binds to the best pin; give side-midpoint pins directional visDirs, corners `ConnDirAll`.

## 4. Declaration files

- `src/types/libavoidWasm.d.ts` — only declares the virtual base64 module, not the Avoid API.
- `node_modules/libavoid-js/typings/libavoid.d.ts` (== `dist/index.d.ts`): loose `[x: string]: any`.
  `declare enum ConnDirFlags { // TODO }` — EMPTY. `ShapeConnectionPin` has extra methods available
  but unused: `setExclusive(bool)`, `isExclusive()`, `directions()`, `position()`, `updatePosition()`
  (relevant if per-pin exclusivity ever needed to stop two edges sharing a corner pin).

## 5. Router setup (src/view/edgeRouting.ts LibavoidEdgeRouter.route ~230-284)

- `arena.newRouter()` → `new avoid.Router(avoid.PolyLineRouting)` — **PolyLine mode** (Orthogonal declared but unused).
- Params (~240-242):
  - `shapeBufferDistance = EDGE_ROUTING_SHAPE_BUFFER_PX = 17` (= EDGE_PAIR_CURVATURE_PX/2)
  - `segmentPenalty = EDGE_ROUTING_SEGMENT_PENALTY_PX = 50`
  - `crossingPenalty = EDGE_ROUTING_CROSSING_PENALTY_PX = 0` (disabled for perf — edge-routing__03: positive value pushed ~100-node/~292-edge fixture ~140ms→~1700ms)
- Obstacles+pins loop (~244-259); connectors loop (~260-273).
- `router.processTransaction()` called ONCE at ~274 after all registration.
- Routes read via `readRoute(conn)` → `conn.displayRoute()` (~213-221, 275-278).
- Cleanup `arena.dispose()` in `finally` (~280-282): destroys tracked leaves then Router last.

### Summary
Single call site to change: `LibavoidEdgeRouter.route()` obstacle loop (~249-257). Replace the one
centre pin with up to 8 boundary pins sharing the class id, with per-side `visDirs`. Add
`ConnDirUp/Down/Left/Right` named fields to the `Avoid` interface (`src/view/libavoidLoader.ts:20-48`).
Router mode + 3 tuned penalties unaffected. `ConnDir*` values come from runtime, not types.
