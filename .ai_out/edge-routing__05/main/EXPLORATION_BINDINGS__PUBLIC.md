# EXPLORATION_BINDINGS — `edge-routing__05` PREREQ spike

> Produced by the EXPLORATION_BINDINGS sub-agent (read-only); transcribed by TOP_LEVEL_AGENT.

## VERDICT: NO BLOCKER. Every API the ticket needs is already bound. No wasm rebuild required.

| API | Available? | Evidence |
|---|---|---|
| `ShapeConnectionPin.setConnectionCost(cost: number): void` | YES | `libavoid-js@0.4.5/typings/libavoid.d.ts:59`; runtime export `_emscripten_bind_ShapeConnectionPin_setConnectionCost_1` + `S.prototype.setConnectionCost` in `dist/index.js:4` (minified); live call succeeded |
| `ShapeConnectionPin.setExclusive(bool): void` | YES | `typings/libavoid.d.ts:60`; `S.prototype.setExclusive` / `_emscripten_bind_ShapeConnectionPin_setExclusive_1`, `dist/index.js:4`; live call round-tripped |
| `ShapeConnectionPin.isExclusive(): boolean` | YES | `typings/libavoid.d.ts:61`; `dist/index.js:4` |
| `ShapeConnectionPin.directions(): number` | YES | `typings/libavoid.d.ts:62`; live: returns `8` for a `ConnDirRight` pin |
| `ShapeConnectionPin.position()` / `.position(poly)` | YES (arity 0 and 1) | `typings/libavoid.d.ts:63`; `_emscripten_bind_ShapeConnectionPin_position_0/_1` |
| `ShapeConnectionPin.updatePosition(Point)` | YES | `typings/libavoid.d.ts:64` |
| `Avoid.portDirectionPenalty` (RoutingParameter enum) | YES, value `5` | `dist/index.js:4` — `t.portDirectionPenalty=di()` where `di = _emscripten_enum_Avoid_RoutingParameter_portDirectionPenalty`; live read = `5` |
| `Router.setRoutingParameter(param, value)` | YES (already used in repo) | `typings/libavoid.d.ts:19`; `src/view/edgeRouting.ts:374-376` |
| `Router.setRoutingOption(option, bool)` | YES | `typings/libavoid.d.ts:20` |
| `Avoid.ConnDirUp/Down/Left/Right/All/None` | YES | `dist/index.js:4` |
| `Avoid.ClusterRef` (for `clusterCrossingPenalty`) | **NO — not bound** | Zero occurrences of `ClusterRef` in `dist/index.js`; `"ClusterRef" in Avoid === false` at runtime. The `clusterCrossingPenalty` enum exists (value `3`) but is inert without cluster registration |

## 1–2. Pin cost & exclusivity — signatures and default semantics

Exact bound signatures (WebIDL-generated, 1 argument each, numeric/bool coerced):

- `setConnectionCost(cost: number): void` — default `m_connection_cost = 0.0` for all three C++
  constructors (`adaptagrams/cola/libavoid/connectionpin.cpp:50,69,147`). **No getter is bound.**
- `setExclusive(exclusive: boolean): void`, `isExclusive(): boolean`.

**Default exclusivity — verified empirically against the shipped wasm (not just docs):**

| Pin kind | `isExclusive()` at construction |
|---|---|
| Directional pin (`ConnDirRight`, 7-arg ctor) | `true` |
| `ConnDirAll` pin (7-arg ctor) | `false` |

Matches libavoid source: `m_exclusive(true)` in each ctor, then `connectionpin.cpp:125-127` —
"A pin with visibility in all directions is not exclusive" → `m_exclusive = false`.

### Consequences for this ticket (IMPORTANT)

- The 12 group boundary pins (`edgeRouting.ts:219-232`, all directional) are **already exclusive
  by default** — ticket Design step 2 (`setExclusive(true)`) is effectively a **no-op** unless we
  want to *disable* it. Real finding: exclusivity is not the missing lever; **cost is**.
- The note-square `CENTRE_PIN_SPEC` (`ConnDirAll`, `edgeRouting.ts:240`) is non-exclusive —
  correct, since many edges terminate there. If Design step 3 replaces it with 4 directional side
  pins, each becomes exclusive by default, **capping a note at 4 connectors before pins are
  exhausted**. This needs an explicit `setExclusive(false)` decision on note pins, or dense hubs
  will misbehave. Highest-value gotcha in this spike.
- Cost semantics (`connectionpin.h:84-94`): "In the case of multiple pins with the same classId,
  this causes the lower-cost pins to be chosen first, rather than libavoid choosing the best pin
  with that classId based solely on connector path cost." Exactly the "prefer the facing side"
  lever the ticket wants, and it works **within the existing single `PIN_CLASS` design**
  (`edgeRouting.ts:266-279`) — no class-id restructuring needed.

## 3. Router parameters

Set via `router.setRoutingParameter(Avoid.<name>, value)` — flat top-level numeric constants on
the Avoid instance, the pattern already used at `src/view/edgeRouting.ts:374-376`.
Live-read enum values:

| RoutingParameter | value |
|---|---|
| `segmentPenalty` | 0 |
| `anglePenalty` | 1 |
| `crossingPenalty` | 2 |
| `clusterCrossingPenalty` | 3 |
| `fixedSharedPathPenalty` | 4 |
| `portDirectionPenalty` | 5 |
| `shapeBufferDistance` | 6 |
| `idealNudgingDistance` | 7 |
| `reverseDirectionPenalty` | 8 |

RoutingOption booleans also bound: `nudgeOrthogonalSegmentsConnectedToShapes`,
`improveHyperedgeRoutesMovingJunctions`, `penaliseOrthogonalSharedPathsAtConnEnds`,
`nudgeOrthogonalTouchingColinearSegments`, `performUnifyingNudgingPreprocessingStep`,
`improveHyperedgeRoutesMovingAddingAndDeletingJunctions`, `nudgeSharedPathsWithCommonEndPoint`.

Note (`adaptagrams/cola/libavoid/router.cpp:1999-2027`): passing a **negative** value selects
libavoid's "sensible active" default — for `portDirectionPenalty` that is `100`. Passing `0`
disables. So `setRoutingParameter(A.portDirectionPenalty, -1)` is a legitimate way to get the
upstream-recommended 100.

## 4. Full `ShapeConnectionPin` surface + ConnDir values

Runtime prototype (`Object.getOwnPropertyNames`): `constructor, setConnectionCost, position,
directions, setExclusive, isExclusive, updatePosition, __destroy__, h`.

Bound constructor arities: **2, 3, 6, 7 only**.
- 7 = `(shape, classId, xOffset, yOffset, proportional, insideOffset, visDirs)` ← what the repo uses
  (`edgeRouting.ts:269-277`)
- 6 = deprecated non-proportional shape form; 3 = `(junction, classId, visDirs)`; 2 = `(junction, classId)`

**Landmine:** arity 4 and 5 dispatch to undefined free identifiers and throw
`ReferenceError: _emscripten_bind_ShapeConnectionPin_ShapeConnectionPin_4 is not defined`
(verified live). Never call the ctor with 4 or 5 args.

ConnDirFlag values (live): `None=0, Up=1, Down=2, Left=4, Right=8, All=15`.

Router prototype also exposes `moveJunction` (present at runtime, absent from the shipped `.d.ts`).

## 5. Version pinning

- `package.json:23` — `"libavoid-js": "0.4.5"` (exact, no caret).
- `package-lock.json:1453-1458` — resolved `libavoid-js-0.4.5.tgz`, integrity
  `sha512-9BrYRXAQ+nmLuHZSqf4z52YN8TroBPxyqo6A6h6Pj03j5UYNx/Hhnd/rg+kiLVrE76wzBeBVO3OW7kaEpzYC9Q==`.
- **`node_modules/` did not exist in this checkout.** To keep the "installed package is
  authoritative" contract the agent fetched the exact registry tarball for 0.4.5 into the session
  scratchpad and **verified its sha512 byte-for-byte against the lockfile integrity above** — so
  everything reported here is the code `npm ci` would install. Nothing was written into the repo.
  → **IMPLEMENTATION must run `npm ci` first.**
- Package contents (complete): `dist/index.js`, `dist/index.d.ts`, `dist/index-node.mjs`,
  `dist/index-node.d.ts`, `dist/libavoid.wasm`, `typings/libavoid.d.ts`, `README.md`, `LICENSE`,
  `package.json`. **No `.idl` file ships.**

## 6. Would extending the WebIDL require a wasm rebuild? — Moot

Yes it would (README build section: Docker + emcc + `python3 ./tools/generate.py`, and no `.idl`
ships) — but **the ticket does not need it**. `setConnectionCost`, `setExclusive`, `isExclusive`,
`directions`, and `portDirectionPenalty` are all already compiled into `dist/libavoid.wasm` and
exposed through the glue.

The only thing to change is the repo's **own local type narrowing**, `src/view/libavoidLoader.ts`:
- `:32-34` — add `readonly portDirectionPenalty: number;` beside the existing
  `shapeBufferDistance`/`segmentPenalty`/`crossingPenalty`.
- `:40-48` — `ShapeConnectionPin` currently constructs to `unknown`; give it a named
  `AvoidShapeConnectionPin` interface with `setConnectionCost(cost: number): void`,
  `setExclusive(b: boolean): void`, `isExclusive(): boolean` so `edgeRouting.ts` can call them
  without casts.

That file already documents this exact pattern (`:23-26`: upstream ships `ConnDirFlags` as an empty
enum, so the repo names them locally). Zero build-system impact — TypeScript only.

**Genuine blocker found (scope, not bindings):** research option C1's "register group boxes as
`Avoid::ClusterRef` + `clusterCrossingPenalty`" is **not achievable** on 0.4.5 — `ClusterRef` is
not in the bindings at all. That item is not in the ticket's Design steps 1-5, so
`edge-routing__05` is unaffected, but the research doc's C1 bullet should be corrected.

## Prior notes found in `docs-internal/`

- `docs-internal/research/research-layout-aesthetics.md:102-120` (section C1) — source of the
  ticket's plan. Asserts "all on the libavoid API we already ship" and "directional pins are
  exclusive by default". **Both now confirmed**, with the caveat that "make pins exclusive" is
  already true for the group boundary pins. Its `ClusterRef`/`clusterCrossingPenalty` bullet
  (`:118-120`) is **wrong for 0.4.5**.
- `docs-internal/research/research-layout-aesthetics.md:48-58,77-82` — B1 root cause and the note
  that nudging/shared-path options are orthogonal-mode-only.
- `docs-internal/CHANGELOG.md:302-304` — only prior recorded binding limitation: the Emscripten
  factory is not exported, so `wasmBinary` injection is unreachable; data-URL `locateFile` used
  instead. Unrelated to pins.
- `docs-internal/CHANGELOG.md:141,181,287-288` — pin history (centre pin → 12 boundary pins), and
  the router-owns-pins ownership rule: **never `destroy()` a `ShapeConnectionPin`** (double-free →
  wasm abort), mirrored at `src/view/edgeRouting.ts:288-298`.
- No pre-existing note anywhere claims `setConnectionCost` or `portDirectionPenalty` was missing —
  this spike is the first authoritative check.
