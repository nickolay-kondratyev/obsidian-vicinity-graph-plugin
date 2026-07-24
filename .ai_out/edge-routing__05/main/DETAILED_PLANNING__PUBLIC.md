# DETAILED_PLANNING — `edge-routing__05` (facing-side attachment)

> PLANNER, THINK_HARD. Read `CLARIFICATION__PUBLIC.md` and the three EXPLORATION files first.
> **This plan contradicts one binding human decision (D1) on the basis of new measurements taken
> against the real libavoid wasm during planning. See §1 and the `#QUESTION_FOR_HUMAN` items.**

---

## 0. Headline — the approved approach is a proven no-op

I ran the shipped `libavoid-js@0.4.5` node build directly (probe scripts under `.tmp/`, see §9) with
the repo's exact router parameters (`shapeBufferDistance 17`, `segmentPenalty 50`,
`crossingPenalty 0`) and the exact shipped `BOUNDARY_PIN_SPECS` (12 pins, one shared class).

| # | Finding | Evidence |
|---|---|---|
| **E1** | `setConnectionCost` **is live** and px-scaled. | Positive control: putting cost 100 on the *facing* side of a 100×100 box moved the attachment off it (50 → no change, 100 → moved). |
| **E2** | **Facing-side pin costs change NOTHING.** A union-of-facing-sides cost model (facing = 0, adjacent = C, opposite = 2C) changed **0 of 818** group attachments across 400 randomised crowded scenes, and 0 of 43 in a systematic scan of a leaf orbiting a group box. | probe3, probe5 |
| **E3** | The wrap-arounds are **not near-ties, they are visibility-BLOCKED**. Re-running the same 802 edges with `C = 100 000` still left **the same 24** non-facing attachments. No finite cost restores a pin libavoid cannot see. | probe6 |
| **E4** | The only per-edge lever libavoid offers is the **pin CLASS ID** on `ConnEnd(shape, classId)`. Re-classing the same 12 pins by side (no pin-count change, **identical routing time**, 409 ms vs 409 ms) cuts non-facing attachments **24 → 2**. | probe8 |
| **E5** | But class restriction **alone is a net loss**: 53 of 802 routes become >50 % longer (lassos around a blocked facing side); total routed length +4.8 %. | probe8 |
| **E6** | **Two passes + keep-the-better is a strict improvement**: baseline (shared-class) pass, facing (side-class) pass, keep the facing route only when it is ≤ 1.25× the baseline length → non-facing **24 → 7**, **zero** routes >1.5× longer, total length **−0.4 %**. | probe9 |
| **E7** | Side-class pins **must** get `setExclusive(false)`. With the libavoid default (directional ⇒ exclusive), the 4th edge facing the same side gets `ConnEnd::assignPinVisibilityTo: no pins with class id …` and silently falls back to the **shape centre** — the exact pre-`edge-routing__04` pathology. With `setExclusive(false)` all 8 test edges attach on the correct border. | probe10 |
| **E8** | **Never co-locate duplicate pins.** Registering each pin twice (shared class + side class at identical coordinates) corrupted routing badly: 761/802 non-facing, +56 % length. Any design needing two class families needs **two routers**, not two pin sets on one shape. | probe7 |
| **E9** | **Latent bug in the shipped code** (independent of this ticket): the 12 group pins are exclusive by default, so a group box with **>12 attached edges** falls back to centre attachment today. | E7 mechanism |

**Consequence:** ticket Design step 1 — the only thing CLARIFICATION D1 put in scope — cannot move a
single route. Shipping it would be a change with a plausible-sounding comment and zero behaviour,
which is exactly the kind of thing `EARN_TRUST` forbids.

The mechanism that *does* work (E4 + E6) is a combination of a lever **not in the ticket's list at
all** (per-edge pin class ids) with **ticket Design step 5**, which D1 explicitly deferred.

---

## 1. Three paths — recommendation and trade-offs

### Path A — **RECOMMENDED**: per-edge facing pin CLASS + keep-the-better second pass

Baseline pass exactly as today; a second pass where group-box pins are re-classed by side and each
`ConnEnd` requests the class of the side facing its counterpart; per edge, keep the facing route
unless it is more than `EDGE_ROUTING_FACING_MAX_LENGTH_RATIO` (1.25) times the baseline length.

- **PRO** — the only measured design that improves route quality without a length regression
  (non-facing 24 → 7, zero lassos, total length −0.4 %).
- **PRO** — the facing pass is skipped entirely when no edge attaches to a folder-group box, so the
  **dense fixture (ungrouped, the perf-critical one) is byte-identical and costs 0 extra ms**.
  Grouped fixtures double a ~9 ms pass.
- **PRO** — pin count, `BOUNDARY_PIN_SPECS`, `crossingPenalty`, settings surface: all unchanged.
- **PRO** — both new decisions are pure functions (`facingSideOf`, route selection), unit-testable
  without wasm exactly as the ticket asks.
- **CON** — it is genuinely more machinery than "set a number": a second router pass, a selection
  rule, one new constant. Roughly +120 lines in `edgeRouting.ts` plus tests.
- **CON** — it re-includes ticket step 5, which D1 deferred, and drops step 1, which D1 approved.
- **CON** — `setExclusive(false)` on group pins is mandatory (E7). That is a real behaviour change
  (several connectors may now share one border pin). It also removes the latent E9 bug.

### Path B — **HONEST MINIMUM**: harness + fixture + a documented negative result, no routing change

Do phases 0 and 1 only, record the measurements, write up "facing-side pin costs are a measured
no-op; the wrap-arounds are visibility-blocked", close the ticket, and file Path A as a new ticket.

- **PRO** — maximal PARETO if the human judges Path A's complexity unjustified for ~22 edges in 800.
- **PRO** — still delivers real value: a repaired measurement harness, a detour readout in the eval
  output, a source-controlled Epictetus fixture, and knowledge that stops the next agent repeating this.
- **CON** — the user-visible symptom in the screenshot is not fixed.

### Path C — **NOT RECOMMENDED**: ship Design step 1 as approved

- **CON** — measured to change nothing (E2, E3). It would add a cost model, a named constant and a
  spec-lock test that collectively assert a behaviour the router does not have.
- **PRO** — none that survive E3.

> `#QUESTION_FOR_HUMAN: CLARIFICATION D1 scoped this ticket to facing-side pin COSTS. Measurement against the real wasm shows that lever changes 0 of 818 group attachments even at cost 100000 — the wrap-arounds are visibility-blocked pins, not near-ties. Do you want (A) the per-edge pin-CLASS + keep-the-better two-pass design (measured: non-facing 24→7, zero lassos, total route length −0.4%, dense fixture untouched), (B) harness + fixture + documented negative result and close, or (C) ship step 1 anyway?`

> `#QUESTION_FOR_HUMAN: Path A requires setExclusive(false) on the group boundary pins — without it a 4th edge facing the same side silently falls back to the group CENTRE (the pre-edge-routing__04 pathology). This also fixes a latent bug that exists TODAY at >12 edges on one group box. Approve setting the group pins non-exclusive (in both passes, so the two passes stay comparable)?`

> `#QUESTION_FOR_HUMAN: If Path B is chosen, should the Path A design become a new ticket (edge-routing__06) or be parked in docs-internal/research/ alongside the crossing-penalty/worker items?`

Everything below plans **Path A**; §7 marks precisely which phases survive under Path B.

---

## 2. Problem understanding

**Goal.** An edge between a folder-group box and a neighbour should terminate on the group border
*facing* that neighbour, instead of wrapping around to a far side (the Epictetus screenshot).

**Constraints (binding).** `crossingPenalty` stays 0. No new user settings. Routing must stay well
under elk+d3 layout time on the dense fixture. Never `destroy()` a router-owned pin. Existing
facing-side real-wasm tests must not have their tolerances loosened.

**Assumptions.**
1. The pathology is group-box-side only; note squares keep their single centre pin (out of scope, D1).
2. `.dev-vault` is the only vault e2e can drive (`ObsidianHarness` hardcodes it).
3. The dense fixture is ungrouped, so no group-pin change can move its numbers — any movement there
   is a bug signal, not a result.

---

## 3. Architecture

Nothing crosses a layer boundary. All work stays in `src/view/` (`edgeRouting.ts`) plus `e2e/` and
`scripts/`. `src/engine/` and `src/adapters/` are untouched; the `EdgeRouter` seam signature is
unchanged, so `GraphViewController`, the route cache, clipping and `detourStats` need **no edits**.

```
extractEdgeRoutingInput (pure, unchanged)
        │
        ▼
LibavoidEdgeRouter.route(input)
   ├─ routePass(input, edges, PinClassMode.Shared)   ← today's behaviour, always runs
   ├─ needsFacingPass(input)?  (pure predicate)
   │     no  → return baseline
   │     yes → routePass(input, groupAttachedEdges, PinClassMode.Facing)
   └─ chooseRoutes(baseline, facing, MAX_RATIO)      ← pure, unit-tested
```

Two **separate routers** (one per pass) — mandated by E8: two class families on one shape means
co-located duplicate pins, which corrupts routing.

### 3.1 The per-edge lever, stated honestly

`ShapeConnectionPin` cost is a property of a **pin on a shape**; it is shared by every connector
touching that shape. A shape with several edges therefore *cannot* express "this edge should attach
left, that one below" through costs — and the measurements show the bias is inert even in the
degree-1 case, because libavoid's path cost already prefers the facing side whenever it is reachable.

`ConnEnd(shape, classId)` is per **connector end**. Class id is therefore the *only* per-edge pin
selection lever libavoid exposes, and it is a **hard filter**, not a bias. The keep-the-better second
pass is what converts that hard filter back into a soft preference. This is the crux of the design;
record it as a WHY comment in `edgeRouting.ts` so the next agent does not retry costs.

### 3.2 Pure pieces (wasm-free, mirroring the `BOUNDARY_PIN_SPECS` spec-lock pattern)

```ts
export type PinSide = "up" | "down" | "left" | "right";

/** TOTAL function: every rect pair yields a side, so a facing ConnEnd always finds pins. */
export function facingSideOf(self: FacingRect, counterpart: FacingRect): PinSide;

/** Pin class per side. Distinct from PIN_CLASS; used only by the facing pass. */
const PIN_CLASS_BY_SIDE: Readonly<Record<PinSide, number>>;

/** True when at least one edge has a folder-group endpoint (else the facing pass is skipped). */
export function needsFacingPass(input: EdgeRoutingInput): boolean;

/** Per edge, keep the facing route unless it is more than `maxRatio` × the baseline length. */
export function chooseRoutes(baseline: EdgeRouteMap, facing: EdgeRouteMap, maxRatio: number): EdgeRouteMap;
```

**`facingSideOf` rules — spell these out in the doc comment, they are the whole cost model:**

1. Axis gaps from the rects (not centres):
   `left = self.x − (cp.x + cp.w)`, `right = cp.x − (self.x + self.w)`,
   `up = self.y − (cp.y + cp.h)`, `down = cp.y − (self.y + self.h)`.
2. If any gap `> 0` → the side with the **largest** gap (the dominant separation). This handles the
   diagonal case without inventing a corner concept, and matches the existing diagonal real-wasm
   test, which only asserts corner *clearance*.
3. Exact tie between a horizontal and a vertical gap → prefer the **horizontal** side (documented
   deterministic default; graph vicinities are wider than tall).
4. Touching (`gap === 0`) counts as **not facing** — strictly `> 0`, no tolerance, deterministic.
5. All gaps `≤ 0` (rects overlap on both axes, or one contains the other — e.g. a group's own child,
   which *is* an obstacle) → fall back to the dominant component of the **centre delta**; exact zero
   → `"right"`. This keeps the function total: a facing `ConnEnd` must never name a class with no
   pins (E7 shows that fallback lands on the shape centre).
6. Distance is deliberately **not** weighted — WHY-NOT comment: a nearer counterpart does not get a
   stronger claim; the second pass, not the side rule, is what handles "the facing side is bad here".

**`chooseRoutes` rule:** for each edge present in `facing`, compute both polyline arc lengths; keep
the facing route when `facingLen <= baselineLen * maxRatio` **or** when the baseline is degenerate
(< 2 points); otherwise keep the baseline. Edges absent from `facing` pass through unchanged.

### 3.3 Named constants

| Constant | Value | Justification |
|---|---|---|
| `EDGE_ROUTING_FACING_MAX_LENGTH_RATIO` | `1.25` | Measured sweep (probe9) over 802 edges: 1.0 → 11 non-facing, 1.1 → 9, **1.25 → 7 with 0 routes >1.5× and total length −0.4 %**, 1.5 → same quality, 2.0 → 5 lassos appear. 1.25 is the knee: it buys back every cheap facing attachment and refuses every lasso. |
| `PIN_CLASS_BY_SIDE` | 4 ids ≠ `PIN_CLASS` | Distinctness is spec-locked by a unit test. |

No new *user* knob — both are module constants, per the ticket's "no new settings" constraint.

### 3.4 Pin object lifetime

`registerPinsForShape` needs the constructed pin only to call `setExclusive(false)` (and, in the
facing pass, nothing else). Therefore:

- Keep the pin in a **local `const` for the duration of the loop body only**. Emscripten WebIDL
  objects are freed exclusively via `__destroy__`/`destroy` — dropping the JS wrapper leaks nothing
  and frees nothing, so no retention structure is needed.
- **Never** push a pin into `AvoidArena.owned`, and never call `avoid.destroy` on it. The Router
  frees its pins in `dispose()`; doing it ourselves double-frees → wasm abort. Re-state this as a
  WHY comment at the call site (the existing block comment at `edgeRouting.ts:288-298` already
  documents the rule; add a one-liner pointing at it from `registerPinsForShape`).
- `libavoidLoader.ts`: give the `ShapeConnectionPin` constructor a real return type
  `AvoidShapeConnectionPin { setExclusive(b: boolean): void; setConnectionCost(cost: number): void; isExclusive(): boolean }`
  instead of `unknown`, following the file's existing "narrow what we use" pattern. Keep
  `setConnectionCost` on the interface even though Path A does not call it — it is bound, and the
  WHY-NOT comment referencing the measured no-op belongs right there.
  **Do not** add `portDirectionPenalty`: probe2 measured it (0 vs 100) with no effect on the
  blocked-corridor case, and D1 makes it optional-if-it-helps. It does not help.

---

## 4. Implementation phases (commit boundaries)

### Phase 0 — repair the eval harness (own commit)

**Goal:** trustworthy before/after numbers. **This phase IS the existing open chore ticket**
`_tickets/e2e-remove-layeredradial-layout-mode-references-left-by-force-layout-only-ticket.md`
(`nid_6lxaenl4oamjxqj6f0eh6rr4c_e`) — close that ticket in this commit rather than duplicating it.

1. `e2e/edgeRoutingEval.e2e.ts`: delete `type LayoutMode`, the `"layered layout routes the dense
   fixture"` test and the `"radial layout SKIPS routing (gated)"` test (its assertion can no longer
   hold — routing is unconditional). `renderFixture` loses its `mode` parameter.
2. `e2e/obsidianHarness.ts`: remove `setLayoutMode` (its only caller is above; it writes a field the
   engine ignores — a behaviourally dead API is worse than none).
3. Fix the stale comment in the PERF BUDGET test that still explains the radial gate.
4. **Add the detour readout** — mandatory, the ticket's headline acceptance number is currently not
   printed. Extend `PerfEntry["data"]` with `maxDetourRatio?` / `meanDetourRatio?` (already present
   in the controller's `console.debug` payload), surface them from `lastDurations`, and include them
   in the `[eval] force/<label>: …` line.
5. Verify: `npx tsc -p e2e/tsconfig.json --noEmit`; `npm run test:e2e -- edgeRoutingEval.e2e.ts` green;
   no `layered|radial` matches under `e2e/`.

### Phase 1 — Epictetus dev-vault fixture + BEFORE measurement (own commit)

**Goal:** a source-controlled, repeatable analogue of the screenshot, and the baseline table.

1. `scripts/setup-dev-vault.sh`: add a **new self-contained fixture**, do not mutate
   `stranded-main`/`p/ep/`. WHY: the script uses `write_if_missing`, so edits to existing fixture
   files never reach an already-created `.dev-vault` — only new paths do.
   Shape (mirrors the screenshot: a degree-1 note beside a group box whose facing corridor is
   crowded): `zzfacing-hub.md` at root; `zzfacing-grp/f1..f4.md` (4-member folder → one group box,
   each member linking the hub so the edges collapse onto the box); `zzfacing-leaf.md` at root,
   linked **only** from one group member (degree-1, its single edge lands on the group box);
   4–6 root crowd notes linked from the hub to populate the corridor around the group.
   `zz` prefix keeps the file explorer tidy, consistent with `zzdense-*`.
2. `e2e/edgeRoutingEval.e2e.ts`: add `{ label: "facing", central: "zzfacing-hub.md" }` to
   `FORCE_FIXTURES` so its numbers and screenshot are captured alongside the others.
3. Run the BEFORE measurement (§5) and paste the table into the ticket notes **in this commit**.
4. **Honesty note to carry into the write-up:** force layout decides where the leaf lands, so this
   fixture cannot *guarantee* it reproduces the wrap on every machine. It is the aggregate/visual
   regression case; the durable behavioural guard is the real-wasm unit test in Phase 2.

### Phase 2 — the facing pass (own commit) — *Path A only*

1. **Failing test first.** Add the new real-wasm test from §6.3 and confirm it is RED against the
   current router before touching `edgeRouting.ts`. Lift the concrete geometry from probe6's
   non-facing scenes (`.tmp/probe6.mjs`) — re-run it and freeze one scene where the shared-class pass
   wraps to a non-facing side while the facing side is reachable.
2. `libavoidLoader.ts`: named `AvoidShapeConnectionPin` return type (§3.4).
3. `edgeRouting.ts`:
   - `PinSide`, `facingSideOf`, `PIN_CLASS_BY_SIDE`, `needsFacingPass`, `chooseRoutes`,
     `EDGE_ROUTING_FACING_MAX_LENGTH_RATIO` — all exported for the pure tests, all documented.
     Keep them in `edgeRouting.ts` beside `BOUNDARY_PIN_SPECS`: pin geometry, pin classing and pin
     registration are one cohesive concept with one owner, and a separate module would need a
     type-only import back into `edgeRouting.ts` for `EdgeRoutingInput`. (Reviewer's call; if the
     file feels overloaded, `src/view/pinFacing.ts` with a `import type` back-edge is the alternative.)
   - Extract the current body of `route()` into a private `routePass(avoid, input, edges, mode)`;
     `route()` becomes the orchestration in §3 diagram. Each pass builds and disposes its own arena.
   - `registerPinsForShape(avoid, shape, kind, mode)`: class id per §3, `setExclusive(false)` on
     folder-group pins in **both** modes (E7/E9 — keeps the two passes comparable and removes the
     >12-edge centre fallback). Note squares are untouched (single `ConnDirAll` centre pin, already
     non-exclusive).
   - The facing pass routes **only** group-attached edges; note→note routes are identical in both
     passes, so re-routing them is pure waste.
4. `npm run check`, `npm test`. Every pre-existing test must stay green **unmodified**; if a
   facing-side tolerance goes red, investigate — do not touch `FACING_BORDER_TOL_PX`,
   `MID_SPAN_TOL_PX` or `CORNER_CLEARANCE_TOL_PX`. (Probed: the horizontal, vertical and diagonal
   pair cases are unchanged by both the cost model and side classing, so they are expected green.)

### Phase 3 — AFTER measurement, docs, follow-ups (own commit)

1. Re-run §5, paste the AFTER table into the ticket notes beside BEFORE.
2. Screenshot smoke: `.out/edge-routing-force-facing.png` from the e2e run, plus a manual pass over
   the real `.out/public` vault from `clear-goals.md` (the ticket's original repro) — record whether
   the Epictetus edge now attaches on the facing side.
3. `docs-internal/CHANGELOG.md` — one entry: the facing pin classes + keep-the-better second pass,
   the measured numbers, `setExclusive(false)`, and the negative result on pin costs.
4. `docs-internal/research/research-layout-aesthetics.md` §C1 — **correct here, not in a follow-up**:
   (a) the `setConnectionCost` bullet is a measured no-op; (b) `Avoid::ClusterRef` is not bound in
   0.4.5 so the cluster bullet is infeasible. Leaving disproved guidance in the doc that generated
   this ticket would send the next agent down the same hole. Keep it to a few lines with the numbers.
5. File the follow-up tickets in §8; close `edge-routing__05`.

---

## 5. Measurement protocol

```bash
npm ci                                   # node_modules/ is absent in this checkout
npm run check
npm test                       > .tmp/unit.log 2>&1
npm run setup:dev-vault        > .tmp/setup-dev-vault.log 2>&1
npm run test:e2e -- edgeRoutingEval.e2e.ts > .tmp/eval-<before|after>.log 2>&1
grep '\[eval\]' .tmp/eval-<before|after>.log
```

Run the eval spec **twice** per side of the comparison and record both (routingMs is noisy; the
harness already picks the heaviest pass of each kind, which is the edge-routing__04 fix for a
false-passing gate). Fixtures: `sparse` (note1), `medium` (hub-medium, the only grouped fixture
today), `dense` (zzdense-hub, ungrouped perf case), `facing` (new, Phase 1).

Record per fixture: `obstacles`, `edges`, `routingMs`, `layoutMs`, `maxDetourRatio`,
`meanDetourRatio`.

**Pass/fail bar** (per D1, plus the checks this design implies):

| Fixture | Bar |
|---|---|
| medium | `maxDetourRatio` improves or holds at **1.000** |
| sparse | improves or holds |
| dense | must **not** get worse. It is ungrouped, so `needsFacingPass` is false and the numbers should be **identical** within noise — any real movement is a bug, investigate before proceeding |
| dense | `routingMs < layoutMs` (existing committed PERF BUDGET gate) **and** within ~10 % of the BEFORE `routingMs` |
| facing (new) | `maxDetourRatio` must not get worse; screenshot shows facing-side attachment |

Baselines of record (edge-routing__04): sparse 2.9/34.4 ms; medium 9.4/35.6 ms, detour 1.000/1.000;
dense 137.2/1463.6 ms, detour 3.096/1.161.

---

## 6. Test plan (BDD, one behaviour per test, colocated)

### 6.1 Pure, no wasm — `src/view/edgeRouting.test.ts`

`describe("facingSideOf")`:
- WHEN the counterpart lies strictly to the left THEN the facing side is `"left"`.
- WHEN it lies strictly above THEN `"up"`.
- WHEN it is diagonal with a larger horizontal gap THEN the horizontal side wins.
- WHEN it is diagonal with a larger vertical gap THEN the vertical side wins.
- WHEN horizontal and vertical gaps are equal THEN the horizontal side wins (documented tie-break).
- WHEN the rects merely touch (gap 0) THEN that side is not treated as facing.
- WHEN the rects overlap on both axes THEN the centre-delta dominant side is returned (never throws).
- WHEN the counterpart is fully contained (a group's own child) THEN a side is still returned.

`describe("PIN_CLASS_BY_SIDE")`: WHEN the class table is inspected THEN the four ids are distinct and
none equals `PIN_CLASS`.

`describe("needsFacingPass")`: WHEN no edge touches a folder-group obstacle THEN it is false (this is
the dense-fixture perf guarantee, asserted without wasm).

`describe("chooseRoutes")`:
- WHEN the facing route is shorter THEN it replaces the baseline.
- WHEN the facing route exceeds `maxRatio` × baseline THEN the baseline is kept.
- WHEN the facing route is exactly `maxRatio` × baseline THEN it is kept (boundary is inclusive).
- WHEN an edge has no facing route THEN its baseline route passes through unchanged.

`describe("EDGE_ROUTING_FACING_MAX_LENGTH_RATIO")`: WHEN the knee of the measured sweep is locked
THEN it is 1.25 (with the measurement in the comment).

Existing `BOUNDARY_PIN_SPECS` spec-lock: **unchanged, untouched**.

### 6.2 Existing real-wasm tests — expected behaviour

All five stay **green and unedited**. Probed directly: the horizontal (right→left), vertical
(bottom→top) and both diagonal corner-clearance cases produce byte-identical endpoints under the
shipped router, under a cost model, and under side classing. If any goes red: investigate the
routing change — **never** loosen `FACING_BORDER_TOL_PX` (3), `MID_SPAN_TOL_PX` (10) or
`CORNER_CLEARANCE_TOL_PX` (12).

### 6.3 New real-wasm tests — `LibavoidEdgeRouter with real wasm`

Both guarded by the existing `if (!loaded) return;` convention.

1. **The ticket's regression guard.** GIVEN a folder-group box whose facing-side corridor is crowded
   but passable, and a note beside it, WHEN routed THEN the edge terminates on the **facing** border.
   Freeze one concrete failing scene from `.tmp/probe6.mjs` (22 of 24 non-facing cases flip under the
   facing pass). This test must be **RED before** the implementation.
2. **The lasso guard.** GIVEN a group box whose facing side is fully walled off, WHEN routed THEN the
   route is no longer than the baseline route × 1.25 (i.e. `chooseRoutes` kept the baseline).
   probe2's sealed-wall scene is the ready-made fixture.
3. **The exhaustion guard (locks `setExclusive(false)`, E7).** GIVEN 8 edges attaching to the same
   side of one group box, WHEN routed THEN no route terminates at the group **centre**. Without
   `setExclusive(false)` five of eight do.

### 6.4 Untouched

`GraphViewController.test.ts` — the `EdgeRouter` seam signature does not change, so its `FakeEdgeRouter`
suite (cache hit, straight-edge fallback, warn-once, clipping) needs no edits and is the regression
net for the controller side.

---

## 7. What survives under Path B

Phase 0 and Phase 1 ship as planned (both are pure value and are prerequisites for any later
attempt). Phase 2 is dropped. Phase 3 shrinks to: the BEFORE table only, the CHANGELOG entry
recording the negative result, the research-doc correction, and the follow-up tickets — with the
Path A design written up as a new ticket.

---

## 8. Follow-up tickets to file at the end

1. **Note-square directional pins.** Ticket Design step 3 (4 side pins per note instead of the centre
   pin). Must be measured on the dense fixture — 8 pins on all shapes cost 8838 ms vs ~1450 ms layout
   (~64×), and E7 means note pins would need `setExclusive(false)` or a dense hub caps at 4 edges.
2. **`docs-internal/specs/graph/arrows.md:40-63` is stale** — still documents the removed
   `edgeRouting` setting. Doc-only, unrelated to this change; a DOC_FIXER-shaped chore.
3. **`ObsidianHarness` hardcodes `.dev-vault`** — no env override, so the ticket's real repro vault
   (`.out/public`) can only be checked by hand. Add `VICINITY_E2E_VAULT`.
4. **`detourStats` has no unit test** (`GraphViewController.ts`), while `detourRatio` has four. Cheap
   gap to close.
5. *(Path B only)* the Path A two-pass facing design as `edge-routing__06`.
6. *(Only if the human declines `setExclusive(false)`)* the latent E9 bug: >12 edges on one group box
   fall back to centre attachment.

---

## 9. Evidence — probe scripts

Written during planning, `.tmp/` only, nothing under `src/`, `e2e/` or `scripts/` was modified.
Each drives the real `libavoid-js@0.4.5` node build with the repo's exact router parameters and pin
specs. Re-runnable with `node .tmp/probeN.mjs` after `npm ci`.

| Script | Question answered |
|---|---|
| `.tmp/probe-pin-cost.mjs` | union-tier cost vs the three existing real-wasm cases (all unchanged) |
| `.tmp/probe2.mjs` | positive control that `setConnectionCost` is live; sealed-corridor wrap; `portDirectionPenalty` (no effect) |
| `.tmp/probe3.mjs` | systematic leaf-orbiting-a-group scan — 0/43 changed |
| `.tmp/probe5.mjs` | 400 randomised crowded scenes — 0/818 changed |
| `.tmp/probe6.mjs` | cost 100 000 still 0 changed; first per-edge-class comparison |
| `.tmp/probe7.mjs` | co-located duplicate pins corrupt routing (E8) |
| `.tmp/probe8.mjs`, `.tmp/probe9.mjs` | clean side-class comparison + the keep-the-better ratio sweep |
| `.tmp/probe10.mjs` | exclusive-pin exhaustion → centre fallback (E7) |
