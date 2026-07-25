# IMPLEMENTATION_ITERATION_B__PUBLIC — edge-routing__06 item (b), step 6

Iteration on `IMPLEMENTATION_REVIEW_B__PUBLIC.md` (verdict READY, so nothing blocked). Base `2f61c7d`;
**not committed** (TOP_LEVEL_AGENT commits).

`npm run check` exit 0 · `npm test` **780 passed / 0 failed** (779 + the one new test) ·
`npx tsc -p e2e/tsconfig.json --noEmit` exit 0.

**The headline: the last hop into libavoid is now asserted.** Re-hardcoding
`setRoutingParameter(avoid.shapeBufferDistance, 17)` used to leave 779/779 unit tests and every e2e
spec green; it now fails, from the far side of the wasm, with the reviewer's own numbers.

---

## 1. Per-item disposition

| # | Item | Disposition | Rationale |
|---|---|---|---|
| **F1** | SHOULD-FIX — the last hop into libavoid has no assertion | **INCORPORATED** | Real-wasm BDD test on the existing blocker scene, written RED first (§2). No new fixture, 1ms, deterministic. |
| **F2** | SHOULD-FIX — `edgeGeometry.ts:7` states a WHY this diff made false | **INCORPORATED** | Re-derived the true reason rather than reworded it (§3). |
| **F3.1** | SHOULD-FIX — no CHANGELOG entry for item (b) | **INCORPORATED** | New dated entry leading with the upgrade effect and the unreachable 17 (§4). |
| **F3.2** | SHOULD-FIX — research doc still *recommends* the shipped change | **INCORPORATED** | Both sites marked SHIPPED with the measured outcome (§5). Not itemized in my brief, but it is a SHOULD-FIX in the review and it is one grep away from the same staleness class as F2. |
| **S2** | corner radius vs minimum clearance relation is newly non-obvious | **INCORPORATED** | One paragraph on `ROUTED_CORNER_RADIUS_PX`, with the arithmetic (§6). Cheap, and the diff already touched that docblock. |
| **S1** | arrowhead constants split across `VicinityEdge.tsx` / `edgeGeometry.ts` | **REJECTED for this pass** — handed over | I agree with the finding; the reviewer's own remedy is "a follow-up ticket rather than a change to this diff", and `_tickets/` is TOP_LEVEL_AGENT-owned by my brief. Paste-ready body in §8. |
| **S3** | restore the word "four" for the native-parity slider group | **REJECTED** | Rationale in §7 — the POLS argument did not ride on the count and is still there in full. |
| **S4** | the retired constant's "small relative to inter-node spacing" thread | **REJECTED** | Rationale in §7 — already carried, in measured rather than estimated form. |
| — | **Self-found**: `VicinityEdge.tsx` asserts a strict `>` the shipped floor contradicts | **FIXED** | Same class as F2: a comment that is false. §6. |

---

## 2. F1 — the test, and the RED-first evidence

`src/view/edgeRouting.test.ts:361`

> **WHEN the same scene is routed at the minimum and the maximum clearance THEN the tighter clearance
> gives the shorter route (the setting reaches libavoid)**

Both endpoints come from `FORCE_LAYOUT_RANGES.edgeRoutingClearancePx`, and the assertion is the
ORDERING (`lengthAtMin < lengthAtMax`), never a length — the numbers are scene-dependent, the relation
is the property. Same discipline as the two invariants above it.

### RED (production line mutated back to a constant)

```diff
- router.setRoutingParameter(avoid.shapeBufferDistance, input.shapeBufferPx);
+ router.setRoutingParameter(avoid.shapeBufferDistance, 17);
```

```
 × src/view/edgeRouting.test.ts > LibavoidEdgeRouter with real wasm > WHEN the same scene is routed
   at the minimum and the maximum clearance THEN the tighter clearance gives the shorter route
   (the setting reaches libavoid) 2ms
   → expected 231.31449065508642 to be less than 231.31449065508642

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected 231.31449065508642 to be less than 231.31449065508642
      Tests  1 failed | 24 passed (25)
```

Both arms collapse onto **231.314…**, which is the reviewer's `buffer=17 routeLength=231.31` to the
digit — independent confirmation that this is the same scene they swept, and that the failure is the
value not arriving rather than a flaky length.

### GREEN (restored, `git diff src/view/edgeRouting.ts` empty)

```
 ✓ … (the setting reaches libavoid) 1ms
 Test Files  1 passed (1)
      Tests  25 passed (25)
```

### The skip convention holds (step 2b's `ctx.skip`, not a bare `return`)

Forced-negative — `avoid = null` in `beforeAll`:

```
 ↓ … (the setting reaches libavoid) 0ms [the libavoid node wasm build did not load in this environment]
      Tests  13 passed | 12 skipped (25)
```

**12 skipped, up from 11**, so the new test genuinely joined the skip set instead of passing
vacuously without wasm.

### Supporting refactor (behaviour-preserving)

- `edgeRouting.test.ts:312` — `route()` → `routeAtClearance(shapeBufferPx)`, with `route()` delegating
  at `SHIPPED_CLEARANCE_PX`. The two pre-existing blocker tests are unchanged in behaviour.
- `edgeRouting.test.ts:339` — `polylineLengthPx()`.
- `edgeRouting.test.ts:34` — `CLEARANCE_RANGE` lifted from inside the invariants `describe` to module
  scope; two describes need it now. The invariant assertions themselves are byte-identical.

---

## 3. F2 — the WHY, re-derived (not reworded)

`src/view/edgeGeometry.ts:7`. Verified by grep that the old justification is dead: `edgeRouting.ts`
imports **nothing** from `edgeGeometry.ts`, in either direction. But the `import type` is still
load-bearing, for a reason with a sibling **in the same file**: `ClipRect` (`:~150`) is deliberately
kept local rather than importing `RoutingObstacle`, "so this pure math layer carries no routing types".
The module has a standing no-runtime-coupling-to-the-routing-layer policy; `RoutedPoint` is its single
exception, legal precisely because the import is erased.

```ts
// The ONE name this pure-math module borrows from the routing layer. `import type`
// is erased at compile time, so the emitted module still depends on NOTHING in that
// layer — the same rule {@link ClipRect} below keeps by staying local instead of
// importing `RoutingObstacle`.
```

A reader can now check the claim in-file, which the cycle wording no longer allowed.

---

## 4. F3.1 — the CHANGELOG entry

`docs-internal/CHANGELOG.md:3`, new dated entry at the head, existing entries untouched (`:50` item (a)
and `:72` "Six force-layout knobs" remain as dated history). It follows the file's format — `##` dated
headline with the ticket ref, a lead paragraph, then bold-led bullets — and states plainly, in this
order:

1. **Existing installs change look with no user action**: never persisted, so everyone is on 17 and
   lands on 11 on upgrade; routes tighten and some edges re-attach. Node positions do **not** move
   (the clearance never reaches elk/d3) — worth saying, because "my graph changed" otherwise reads as
   a layout regression.
2. **17px is no longer reachable, deliberately**, with the measurement that makes it the pathology
   (40 non-facing attachments at 17 vs 22-26 at ≤14) — a user who preferred the old look cannot
   restore it.
3. The new setting, its home, the measured default and the two geometric bounds; the two invariants
   it **replaced** and why each old one was unjustified.
4. The dense/facing detour improvements, with the honest read that a sparse graph looks the same.
5. **No settings are lost — `PERSISTED_SHAPE_VERSION` is NOT bumped**, and why that is the *safe*
   direction (a bump makes `parsePluginData` discard the whole file).
6. The live-slider/route-cache story and the accepted relayout cost; the new facing-side e2e gate.

---

## 5. F3.2 — research doc

| File:line | Change |
|---|---|
| `docs-internal/research/research-layout-aesthetics.md:145-151` | "**Reduce `shapeBufferDistance`** (17px today) … Also in `edge-routing__06`" → **SHIPPED in item (b)**, naming the setting, default 11, clamp 6-14, why 17 is out of reach, and the dense detour outcome. |
| `…:259-263` | Sequencing §E.1 "what remains is `setExclusive(false)` + a smaller `shapeBufferDistance`" → **DONE**, both shipped, perf budget re-measured and holding. |

Same treatment the doc's disproved "4th edge → CENTRE" text already got: corrected in place, outcome
recorded, no history rewritten.

---

## 6. S2 + the self-found false comment

| File:line | Change |
|---|---|
| `src/view/edgeGeometry.ts:138-143` | `ROUTED_CORNER_RADIUS_PX` doc now records that this radius can, since edge-routing__06, **exceed** the minimum reachable clearance (10 > 6) — impossible while the buffer was a fixed 17 — and why it is still safe: rounding cuts inward only `r(1 − 1/√2) ≈ 2.9px`, against `clearance·√2 ≈ 8.5px` of diagonal margin at a buffer-expanded corner. Ends with the re-check trigger. |
| `src/view/VicinityEdge.tsx:26-30` | **Self-found.** The docblock justifying `ARROWHEAD_HALF_WIDTH_PX`'s export said the head stays outside "as long as `clearance > ARROWHEAD_HALF_WIDTH_PX`" — strict, while the shipped floor is `min: 6 == 6` and `edgeRouting.test.ts:159` asserts `>=`. The one constant whose export exists to state this relation contradicted the test asserting it. Now `>=`, with the grazing case spelled out. |

---

## 7. Rejections, with reasons

**S3 — restoring "four" for the native-parity group. REJECTED.** The reviewer's premise is that the
count carried the POLS rationale. It did not: `VicinityGraphSettingTab.ts:147-149` still reads *"The
primary sliders carry the SAME names as Obsidian's native graph view (POLS — users already know
them)"* — the entire argument, count-free, and `ForceLayoutSection.tsx:15` likewise. What "four" adds
is a number that nothing asserts, in prose, in a review that just found exactly that construct lying in
three separate places. `FORCE_LAYOUT_MAIN_FIELDS` is the machine-checked home for the count. I do
accept the reviewer's distinction (four is pinned by an external product, six was not) — it is simply
not enough to reintroduce an unasserted count.

**S4 — the "small relative to inter-node spacing" thread. REJECTED as already carried, in stronger
form.** `SettingsSpec.ts:217-244` states the same concern as a *measurement* — "dense-fixture detour
improved monotonically as the clearance shrank (max 1.342 → 1.188)" — rather than the old constant's
prose estimate about 40px nodes and hundreds of px of spacing. The reviewer's own words are "strictly
satisfied and superseded"; re-adding the estimate next to the measurement would be knowledge
duplication with the weaker copy.

**S1 — arrowhead geometry split. REJECTED for this diff, escalated.** I agree with the finding, and
with the reviewer that the remedy is a ticket, not a change here. My brief forbids editing `_tickets/`.
Paste-ready body for TOP_LEVEL_AGENT:

> **Move both arrowhead dimensions into `edgeGeometry.ts`.** `ARROWHEAD_HALF_WIDTH_PX` and
> `ARROWHEAD_LENGTH_PX` live in the React component `src/view/VicinityEdge.tsx`, while their sibling
> `EDGE_ARROWHEAD_INSET_MIN_PX` lives in the RF-free, node-testable `src/view/edgeGeometry.ts` whose
> docblock already claims "pure SVG path math for the custom graph edge". edge-routing__06 made the
> split load-bearing: exporting the half-width as the clearance floor means `edgeRouting.test.ts` now
> imports a React component file purely to read a geometry number. Pre-existing, newly visible; SRP
> says one home. No behaviour change.

---

## 8. Verification (real output)

```
$ npm run check                             → CHECK_EXIT=0
$ npx tsc -p e2e/tsconfig.json --noEmit     → E2E_TSC_EXIT=0
$ npm test                                  → UNIT_EXIT=0
                                              Test Files  63 passed (63)
                                                   Tests  780 passed (780)
```

**780 vs the reviewer-verified 779: exactly +1**, the new real-wasm test. No test removed, skipped,
weakened or renamed; the PERF BUDGET assertions, the facing-side e2e gate, the two replaced invariants,
`FACING_BORDER_TOL_PX` / `MID_SPAN_TOL_PX` / `CORNER_CLEARANCE_TOL_PX` / `GROUP_CENTRE_TOL_PX` and
`EDGE_ROUTING_CROSSING_PENALTY_PX = 0` are all untouched. No `ShapeConnectionPin` goes near
`AvoidArena.owned` or a `destroy()` path — `registerPinsForShape` was not opened.

**`npm run test:e2e` deliberately NOT run, and here is the evidence that it was not needed:**

```
$ git diff -U0 src/view/edgeGeometry.ts src/view/VicinityEdge.tsx \
    | grep -E "^[+-]" | grep -vE "^(\+\+\+|---)" | grep -vE "^[+-]\s*(\*|//|/\*)"
(no output)
```

Every shipped-source line this step changed is a **comment**. `src/view/edgeRouting.ts` is
byte-identical to HEAD (the F1 mutation was restored from `.tmp/s6/edgeRouting.ts.bak`;
`git diff --stat` on it is empty). The remaining changes are one test file and two docs. Nothing
e2e-visible moved.

Full diff: `docs-internal/CHANGELOG.md` (+47), `docs-internal/research/research-layout-aesthetics.md`
(+12/−5), `src/view/edgeRouting.test.ts` (+38/−4), `src/view/edgeGeometry.ts` (+9/−2),
`src/view/VicinityEdge.tsx` (+3/−1).

Logs: `.tmp/s6/{red1,green1,skip,check,e2e-tsc,unit}.log`. Backups: `.tmp/s6/*.bak`.

---

## 9. `#QUESTION_FOR_HUMAN:`

No new ones. Two carried forward, both still unanswered and neither re-litigated by me:

1. **`#QUESTION_FOR_HUMAN:` the `min: 6` strict-vs-inclusive floor** (STEP5A §8.1). D3's prose said
   assert `min > 6`, D3's range says `min: 6`; the shipped reading is `>=`, i.e. at the floor the
   arrowhead's body grazes the boundary without crossing it. The reviewer independently endorsed `>=`
   as geometrically sound and called `min: 7` gold-plating. This step **hardened** the shipped reading
   rather than changing it: `VicinityEdge.tsx`'s docblock now says `>=` too, so if you do want the
   strict inequality the change is three places — `SettingsSpec.ts:245` (`min: 7`),
   `edgeRouting.test.ts:159` (matcher), and that docblock.
2. **`#QUESTION_FOR_HUMAN:` the Edge clearance slider triggers a full elk+d3 relayout** it does not
   need (~1.4s on the dense fixture, graph visibly re-settles). D1 accepted this in the abstract; it
   is user-visible. Now also stated in the CHANGELOG entry as an accepted cost, so shipping without a
   decision is at least honest — but a follow-up ticket to exclude this one field from the relayout
   trigger is still the right call if you want it fixed.

### Ticket-notes rows still outstanding (TOP_LEVEL_AGENT, unchanged by me)

Checklist rows **1b** (D3 decision + rationale into the ticket) and **3b** (the sweep table), plus the
S1 ticket in §7 if you agree with it. `_tickets/` was not opened by this step.
