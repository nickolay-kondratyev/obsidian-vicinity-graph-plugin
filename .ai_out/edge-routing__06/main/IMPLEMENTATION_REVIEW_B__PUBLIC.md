# IMPLEMENTATION_REVIEW_B__PUBLIC — edge-routing__06 item (b)

Review of commits `fc94c33` (core) and `dc71503` (surface), base `3786495`.
Everything below was verified first-hand — commands, mutations and probes are reproduced in
this file with real output. Nothing is taken from the implementer's notes on trust.

**Verdict: READY.** No blocking findings. Three SHOULD-FIX items, none of which make the
shipped behaviour wrong; one of them (§F1) is a real hole in the safety net that should be
closed before this area is touched again.

---

## Summary

The libavoid `shapeBufferDistance` stopped being a hardcoded 17px view constant and became
`ForceLayoutSettings.edgeRoutingClearancePx` — default 11, clamp 6-14 step 1, persisted,
clamped, cascaded, and surfaced as an "Edge clearance" slider in *Advanced spacing* on both
settings surfaces. The two behaviour-capturing buffer invariants were replaced (not loosened)
with two that are asserted against the whole reachable RANGE. `GROUP_SIDE_PADDING_PX` was
extracted out of the elk padding string and `ARROWHEAD_HALF_WIDTH_PX` exported so both bounds
are machine-checked. A first automated gate for the facing-side property landed in
`e2e/edgeRouting.e2e.ts`.

Quality is high. The riskiest thing in the design — a route cache keyed only on geometry, which
would have made the slider dead while looking alive — was identified, written RED first, and
genuinely fixed. The work is honest about its own limits (the "the picture looks the same"
paragraph, the stale-bundle trap, the two open questions), which is the behaviour I want to see.

---

## 🚨 CRITICAL Issues

**None.**

Explicitly checked and cleared: no custom crypto, no secrets, no injection surface, no
swallowed exceptions on the new path, no resource leak (no `ShapeConnectionPin` reaches
`AvoidArena.owned`; `registerPinsForShape` untouched), no behaviour-capturing test removed,
skipped or loosened, no anchor point removed, no build artifact hand-edited.

---

## ⚠️ IMPORTANT Issues

### F1 · SHOULD-FIX — the LAST hop into libavoid has no assertion anywhere

**This is the one finding I want acted on.** The chain is correct today, but the guard stops one
line short of the end.

Mutation **M4** — the single line that actually applies the setting:

```ts
// src/view/edgeRouting.ts:395
- router.setRoutingParameter(avoid.shapeBufferDistance, input.shapeBufferPx);
+ router.setRoutingParameter(avoid.shapeBufferDistance, 17);
```

Real result: **`npm test` 779/779 green, `npm run check` green, and every e2e spec green** —
`edgeRouting.e2e.ts` 2 passed, `edgeRoutingEval.e2e.ts` 7 passed including PERF BUDGET. The eval
merely *printed* the regression without asserting it:

```
[eval] force/dense:  maxDetourRatio=1.342 meanDetourRatio=1.067   <- BEFORE numbers, fully green
[eval] force/facing: maxDetourRatio=1.310 meanDetourRatio=1.061
```

So a future edit that re-hardcodes the buffer ships a **silently dead slider** through a
completely green suite. That is precisely the failure mode the RED-first controller tests were
written to prevent — M1 and M2 prove the chain is guarded up to `EdgeRoutingInput`, and then it
stops. (M6: the new facing e2e test also passes at buffer 17, so it guards item (a), not item (b).)

**Concrete fix, feasibility already measured.** No new fixture, no flake. I ran the existing
A/B/blocker real-wasm scene at five clearances and got a deterministic, monotone signal:

```
buffer= 6  routeLength=216.64
buffer= 8  routeLength=218.89
buffer=11  routeLength=222.61
buffer=14  routeLength=226.74
buffer=17  routeLength=231.31
```

Add one BDD test next to the existing real-wasm block in `src/view/edgeRouting.test.ts`:

> `WHEN the same scene is routed at the minimum and the maximum clearance THEN the tighter
> clearance produces the shorter route (the setting reaches libavoid)`
> — route the blocker scene at `CLEARANCE_RANGE.min` and `CLEARANCE_RANGE.max`, assert
> `lengthAtMin < lengthAtMax`. Both endpoints come from `FORCE_LAYOUT_RANGES`, so it stays a
> relation rather than a magic number, exactly like the two replaced invariants.

### F2 · SHOULD-FIX — a WHY comment that this diff turned false

`src/view/edgeGeometry.ts:7-8`:

```ts
// Type-only import: erased at compile time, so it introduces NO runtime import
// cycle with edgeRouting.ts (which imports EDGE_PAIR_CURVATURE_PX from here).
```

`fc94c33` deleted exactly that import (`-import { EDGE_PAIR_CURVATURE_PX } from "./edgeGeometry";`
at `edgeRouting.ts:1`). Verified by grep: `edgeRouting.ts` now imports **nothing** from
`edgeGeometry.ts`, so the cycle the comment guards against no longer exists in either direction.
The comment's conclusion is still fine; its stated justification names a dependency that is gone,
which is the kind of stale WHY that misleads the next reader.

**Fix:** reword to state the rule without the dead example, e.g. *"Type-only import: erased at
compile time, so importing from `edgeRouting.ts` cannot create a runtime cycle."*

### F3 · SHOULD-FIX — user-facing knowledge is not written down where users and maintainers look

Two distinct gaps, one already raised as `#QUESTION_FOR_HUMAN:` in STEP5B §7.1:

1. **No `docs-internal/CHANGELOG.md` entry for item (b).** Item (a) got a full entry at the head
   of the file. Item (b) is the larger user-visible change: a seventh slider, **and every existing
   user's routing clearance silently moves 17 → 11 on upgrade, so their graphs re-route**. That is
   exactly what a changelog exists to announce. **My recommendation: write it** (see §Q1 below for
   the content I would insist on). Leaving `:72` "Six force-layout knobs are now user-tunable"
   alone as dated history was the right call — do not rewrite history, add the new entry.
2. **`docs-internal/research/research-layout-aesthetics.md:145` and `:256` still recommend this
   change as future work**: *"**Reduce `shapeBufferDistance`** (17px today) — it is what blocks the
   facing pins... Also in `edge-routing__06`."* It is no longer 17, and it is no longer a
   recommendation — it shipped, with a measured default and a user setting. Same class as the
   still-open finding from my item-(a) review (that doc's disproved "4th edge → CENTRE" text was
   subsequently corrected in place, so the doc IS maintained — this line just needs the same
   treatment). Mark it SHIPPED with the measured outcome and point at the setting.

---

## 💡 Suggestions

- **S1 — arrowhead geometry is now split across two modules.** `ARROWHEAD_HALF_WIDTH_PX` (and
  `ARROWHEAD_LENGTH_PX`) live in the React component `src/view/VicinityEdge.tsx`, while their
  sibling `EDGE_ARROWHEAD_INSET_MIN_PX` lives in the deliberately RF-free, node-testable
  `src/view/edgeGeometry.ts`. Exporting the half-width made the split load-bearing:
  `edgeRouting.test.ts` now imports a React component file purely to read a geometry number.
  Cohesion (SRP) argues for moving both arrowhead dimensions into `edgeGeometry.ts`, whose
  docblock already claims ownership of "pure SVG path math for the custom graph edge". Pre-existing
  split, newly visible — a follow-up ticket rather than a change to this diff.
- **S2 — one geometric relation changed character and nobody wrote it down.**
  `ROUTED_CORNER_RADIUS_PX = 10` is now, for the first time, **larger than the minimum reachable
  clearance (6)** — impossible while the buffer was a fixed 17. Corner rounding cuts inward by
  `r(1 − 1/√2) ≈ 2.9px`; the diagonal margin at a buffer-expanded corner is `6√2 ≈ 8.49px`, so the
  drawn curve still stays outside the box. **It is safe** — but this diff already touches that
  constant's doc, and one sentence there would preserve the reasoning instead of leaving the next
  person to re-derive it.
- **S3 — the "four" deletion over-corrected.** STEP5B's rule ("delete incidental counts, seven
  goes stale like six") is right for *"the **two** advanced sliders"* — that count moved. It is
  wrong for *"the **four** primary sliders"* at `VicinityGraphSettingTab.ts:148` and
  `ForceLayoutSection.tsx:15`: four is pinned by Obsidian's native graph and by
  `FORCE_LAYOUT_MAIN_FIELDS`, and it carried the POLS rationale ("four sliders named like the
  native graph"). Suggest restoring "four" for the native-parity group only, keeping the advanced
  group count-free.
- **S4 — one thread of the retired constant's rationale did not make the move.** The old
  `EDGE_ROUTING_SHAPE_BUFFER_PX` block also argued the buffer must stay *"small relative to
  inter-node spacing (min node 40px, layouts space centres hundreds of px apart) so dense
  vicinities don't detour absurdly."* The new spec JSDoc does not carry that framing. It is
  strictly satisfied (new max 14 < old 17) and superseded by the recorded detour measurements, so
  this is genuinely minor — noting it only because §6 of the brief asked whether any WHY was lost.

---

## Verified — no findings

Stated explicitly where that is the honest answer.

### V1 · The slider works end-to-end — verified live, not inferred

Chain traced and mutation-tested at every joint:

`SETTINGS_SPEC.globalView.forceLayout.edgeRoutingClearancePx` → `EngineDefaults` /
`clampForceLayoutSettings` → `parseForceLayout` (clamped) → resolver cascade →
`graph.viewSettings.forceLayout.edgeRoutingClearancePx` (`GraphViewController.ts:226-232`) →
`resolveRoutes(..., edgeRoutingClearancePx, token)` → `extractEdgeRoutingInput({ shapeBufferPx })`
→ `routingSignature` → `router.setRoutingParameter(avoid.shapeBufferDistance, input.shapeBufferPx)`.

| Mutation | Result |
|---|---|
| **M1** drop `String(input.shapeBufferPx)` from `routingSignature` | `Tests 1 failed \| 38 passed` — the cache test fails. **Teeth confirmed.** |
| **M2** `resolveRoutes(..., 17, token)` | `Tests 2 failed \| 37 passed` — arrival + cache. **Teeth confirmed.** |

The RED-first claim in STEP5A §4 holds up: `expected 1 to be 2` is the predicted cache trap, and
`FakeLayout` determinism makes it a genuine reproduction of "identical geometry, different
clearance". The signature prepends the clearance ahead of the ` `-joined geometry, so there is
no field-collision ambiguity.

**Live confirmation beyond the tests**: my own `[eval]` run at HEAD reproduces the AFTER numbers
exactly, and my worktree run with the buffer forced back to 17 reproduces the BEFORE numbers
exactly (§V6). The value demonstrably reaches libavoid in the real bundle.

### V2 · Conformance to D1-D6 — all six confirmed

| Decision | Status |
|---|---|
| **D1** 7th field on `ForceLayoutSettings`, not a `ViewSettings` field | ✅ `types.ts:222-234`, with the WHY-it-lives-here and the accepted relayout cost stated in JSDoc as D1 required. |
| **D3** default 11, clamp 6-14 step 1 | ✅ `SettingsSpec.ts:245`; baselines locked in `SettingsSpec.test.ts:74,:103` and `forceLayoutSettings.test.ts:23`. |
| **D3** both invariants REPLACED, rationale in the test comments | ✅ `edgeRouting.test.ts:117-155`. See §V4. |
| **D3** supporting refactor: export `ARROWHEAD_HALF_WIDTH_PX`, extract `GROUP_SIDE_PADDING_PX` that the elk string is BUILT FROM | ✅ both, plus a literal lock the decision did not ask for. See §V5. |
| **D4** label "Edge clearance", in *Advanced spacing*, after Node spacing / Group member spacing | ✅ verified in the rendered UI (`.out/settings-row/force-layout-card-light.png`): third row of the disclosure, correct order, sibling-consistent copy and altitude, control column flush. |
| **D1** no `PERSISTED_SHAPE_VERSION` bump | ✅ and independently proven — see §V3. |
| **D5** fixture instead of the 457MB real vault | ✅ `facing/` fixture in `scripts/setup-dev-vault.sh:240-280`, plus `.out/epictetus-{before,after}.png`. |
| **D6** follow-ups | ✅ four filed earlier; the a11y ticket landed in `2f61c7d` during this review. |

Also correct, and worth calling out because the brief pre-supposed otherwise: **the settings tab
needed no code.** `VicinityGraphSettingTab.ts` was touched for comments only. Both surfaces iterate
`FORCE_LAYOUT_ADVANCED_FIELDS` with bounds from `FORCE_LAYOUT_RANGES`, so **no bound is re-typed in
the view layer** — the right call, and refusing the brief's task 1 was correct.

### V3 · The no-bump call — constructed and verified, not trusted

I built a realistic pre-change `data.json` (version 2, non-default force layout, pins, exclusion,
NO `edgeRoutingClearancePx`) and parsed it:

```
forceLayout: repelStrength 900 · linkStrengthFactor 3 · linkGapPx 123 ·
             collidePaddingPx 77 · elkNodeSpacingPx 55   <- all SURVIVE
             edgeRoutingClearancePx: 11                  <- only this defaults
pins: [{docid abc, pinTimestamp 1234}]   exclusion: {enabled true, patterns [daily/*]}  <- intact
```

And the clamp on a hand-edited file: `999 → 14`, `-5 → 6`.

The reasoning in `persistedShapes.ts:196-199` is right for the right reason: `parsePluginData:89-91`
returns defaults **wholesale** on a version mismatch, so a bump would be destructive, not a
migration. The new test at `persistedShapes.test.ts:165-177` proves the claim directly rather than
by analogy. No finding.

### V4 · The replaced invariants — teeth, and the `>=` verdict

**(a) Teeth.** Mutation **M3** (spec widened to `min: 5, max: 16`): `Tests 2 failed | 22 passed`,
one failure per invariant. Both bite. Asserting against `FORCE_LAYOUT_RANGES` rather than the
default is strictly stronger than what shipped before — the properties now hold for *every*
reachable value, including a clamped hand-edited `data.json`.

**(b) Is `>=` sound? My own geometric verdict: yes — tangent, not overlapping.** libavoid routes on
the visibility graph of buffer-expanded shapes, so a corner-hugging route sits at distance exactly
`buffer` from the box it clears. With `buffer = 6` and a perpendicular half-width of 6, the
arrowhead's outer vertex lands **on** the boundary: zero-area contact, nothing crosses. `min: 7`
would be gold-plating. TOP_LEVEL_AGENT's written `min > 6` is arithmetically incompatible with its
own `min: 6`; the implementer shipped the coherent reading, flagged the contradiction instead of
burying it, and pointed at the one-line change if the human wants strictness. That is the right
handling. (Scope note, and the comments get this right: the invariant governs boxes a route
*passes*; route ENDS are pin-attached on their own shape's border and are not buffer-separated
from it. `edgeRouting.test.ts:151` says "clears every box by `clearance`", correctly conditioned —
no overclaim.)

**(c) Is the `GROUP_SIDE_PADDING_PX` extraction faithful? Yes — byte-identical.**
`(36).toFixed(1) === "36.0"` and `(16).toFixed(1) === "16.0"`, so the assembled string is exactly
`[top=36.0,left=16.0,bottom=16.0,right=16.0]`. Layout did not shift. The new literal lock at
`elkMapping.test.ts:102-110` is the right instinct and closes a real hole — the pre-existing
assertion at `:99` compares `ELK_GROUP_PADDING` against itself and is blind to a change in the
string. Good catch by the implementer, unprompted.

### V5 · Numeric duplication is forced by layering, and correctly bridged

`SETTINGS_SPEC` lives in the pure engine and cannot import `src/view/` constants
(`importGuard.test.ts` would fail). So `min: 6` sitting alongside `ARROWHEAD_HALF_WIDTH_PX = 6` is
**not** a DRY violation to fix — it is an unavoidable consequence of the layering, and the
implementer bridged it the only correct way: a test that asserts the *relation* between the two.
`max: 14` vs `GROUP_SIDE_PADDING_PX = 16` are not equal at all, so no duplication there. `16` now
has exactly one home. No dead code was left behind (`EDGE_PAIR_CURVATURE_PX` and
`EDGE_ARROWHEAD_INSET_MIN_PX` both remain in genuine use).

### V6 · The facing-side e2e assertion — independently mutation-tested

I reverted item (a) in a throwaway worktree (`pin.setExclusive(false)` → `void pin;`), rebuilt that
worktree's dev vault, and ran the spec. Reproduced STEP5B §3 **exactly**:

```
✘ 2 e2e/edgeRouting.e2e.ts:237:1 › WHEN a folder group is crowded from one side THEN no edge
    attaches on a border facing away from the neighbours (90ms)
  Error: edges wrapped past the facing side: facingSide=[top] terminals=[12]
  + Array [ "left@855,679", "left@855,621", "left@855,564", "bottom@1138,736" ]
```

Robustness, judged independently:
- **Not brittle.** The facing side is derived from the neighbour centroid's dominant axis, and the
  only numeric constant is a 6px *tolerance*. No box coordinates, sizes or positions are encoded.
  Nearest-border classification (not a first-match ladder) is the right choice for corner points.
- **Cannot pass vacuously.** `MIN_FACING_BOX_TERMINALS = 8` is polled before the property is
  asserted; the mutated run printed `terminals=[12]`, proving the floor is well below the real
  count and that a dead selector would fail rather than pass. Endpoints inside the box (the hub,
  which is a group member) classify as `null`, so they cannot pad the count.
- **Order-independent.** I ran it in isolation (`-g "crowded from one side"`): 1 passed. It does
  not depend on the preceding test in the serial file.
- **Right home.** `edgeRouting.e2e.ts` (the regression spec) rather than `edgeRoutingEval.e2e.ts`
  (a measurement harness whose own header disclaims being a tight regression). Agreed.
- The docblock's justification — that `[eval]` detour ratios are provably blind to attachment side
  — is corroborated by my M6 run, where the facing test's property held at both clearances.

**This is the most valuable thing in `dc71503`.** The behaviour the whole ticket exists to fix had
no automated gate at all before it.

### V7 · The AFTER numbers are real — corroboration, not a smell

I asked the same question the brief did, and the answer is corroboration. I ran **both arms myself**
on this machine, through a freshly rebuilt bundle:

| fixture | metric | mine @17 (M4 worktree) | mine @11 (HEAD) | STEP5B reported |
|---|---|---|---|---|
| dense | maxDetourRatio | 1.342 | **1.244** | 1.342 → 1.244 ✅ |
| dense | meanDetourRatio | 1.067 | **1.046** | 1.067 → 1.046 ✅ |
| facing | maxDetourRatio | 1.310 | **1.266** | 1.310 → 1.266 ✅ |
| facing | meanDetourRatio | 1.061 | **1.047** | 1.061 → 1.047 ✅ |

Exact match on all eight figures. The routing pass is deterministic for a seeded layout, so landing
on `SWEEP__PUBLIC.md` §2.2's prediction (1.244 / 1.046) is what a correct model *should* do — the
sweep measured the same pipeline. Not fabricated, not a coincidence.

**Bundle freshness confirmed independently**: `grep -c edgeRoutingClearancePx` in
`.dev-vault/.obsidian/plugins/vicinity-graph/main.js` returns 2 both before and after a fresh
`npm run setup:dev-vault`. STEP5B's stale-bundle trap is real and worth the prominence it was given;
the final numbers came from a bundle that contains the field.

**PERF BUDGET passes**: `routingMs=134.1` vs `layoutMs=1382.7`, ~10.3x margin, assertions untouched.
**`EDGE_ROUTING_CROSSING_PENALTY_PX` still 0** (`edgeRouting.ts:91`, asserted).
The ms wobble is correctly reported as noise rather than dressed up as a speedup.

### V8 · No loss of previous functionality

`git diff 3786495..HEAD -- src e2e` reviewed line by line. No test removed, skipped or weakened; no
`ap_XXX_E` anchor touched; no assertion loosened. `FACING_BORDER_TOL_PX`, `MID_SPAN_TOL_PX`,
`CORNER_CLEARANCE_TOL_PX`, `GROUP_CENTRE_TOL_PX` and every real-wasm assertion are byte-identical —
the ticket's standing constraint ("if a facing-side real-wasm test goes red, investigate, do not
loosen these") was respected. The 779-test count is +5 over the baseline, all additions. The two
replaced invariants are the only deletions and they were human-decided in D3, replaced 2-for-2 with
strictly stronger statements, and each carries its measured rationale in the test comment as the
acceptance criterion requires.

Copy deletions in `dc71503` were checked for information loss: `settingsResetPlan.ts:94` and the
README lost only a stale count, and both name the groups instead — a genuine improvement. The one
deletion I would partly reverse is "four" (§S3). `docs-internal/CHANGELOG.md:72` was correctly left
alone as dated history.

---

## Acceptance-criteria checklist — ticket item (b)

| # | Criterion | Status |
|---|---|---|
| 1 | Human explicitly decided how the two invariants resolve; **recorded in the test comments** | ✅ `edgeRouting.test.ts:117-155`, each with its measured rationale |
| 1b | …**and recorded in this ticket** | ❌ **OUTSTANDING** — `_tickets/edge-routing06-….md` is unmodified since `6a64555`. TOP_LEVEL_AGENT owns. |
| 2 | Neither invariant silently loosened or deleted | ✅ replaced, strictly stronger, D3-approved |
| 3 | Sweep table 5/8/11/14/17 measured, one screenshot per value under `.out/` | ✅ measured (`SWEEP__PUBLIC.md`); screenshots present: `sweep-buffer{05,08,11,14,16,17}-{sparse,medium,dense}.png` |
| 3b | …**table pasted into this ticket's notes** | ❌ **OUTSTANDING** — same owner as 1b |
| 4 | Shipped default is the swept value the human chose, not an assumed one | ✅ 11, per D3; the ticket's originally proposed 5 was correctly not taken |
| 5 | Reachable end-to-end: engine default + clamp range | ✅ `SettingsSpec.ts:217-245`, `constants.ts:97,:144` |
| 5b | …persisted shape, with an **explicit call** on `PERSISTED_SHAPE_VERSION` | ✅ no bump, reasoned in code at `persistedShapes.ts:196-199`, locked by a test, and independently verified in §V3 |
| 5c | …settings tab row | ✅ verified rendered (screenshot) and by e2e `getByLabel("Edge clearance")` in the in-graph panel + `toHaveCount(7)` |
| 5d | …README "Settings model" entry | ✅ `README.md:66-72` |
| 6 | `npm run check` and `npm test` green | ✅ verified by me: exit 0; 63 files / **779 tests passed** |
| 7 | `npm run test:e2e -- edgeRoutingEval.e2e.ts` green **including PERF BUDGET** | ✅ verified by me: 5 passed (24.4s), budget 134.1ms vs 1382.7ms |
| 8 | `EDGE_ROUTING_CROSSING_PENALTY_PX` still 0; routing well under layout | ✅ both |
| 9 | Screenshot smoke for the Epictetus symptom | ✅ per **D5**, recreated as the permanent `facing/` fixture + `.out/epictetus-{before,after}.png`; the honest read (small on this fixture) is recorded |
| — | **Not required, but delivered**: first automated gate for the facing-side property | ✅ `e2e/edgeRouting.e2e.ts:237`, teeth independently reproduced |

The two ❌ rows are ticket-notes hygiene, explicitly assigned to TOP_LEVEL_AGENT, not
implementation defects. They are the only things standing between this and a closable ticket.

---

## Documentation Updates Needed

1. **`docs-internal/CHANGELOG.md`** — new entry for item (b) (§F3.1, §Q1). Required.
2. **`docs-internal/research/research-layout-aesthetics.md:145` and `:256`** — mark the
   `shapeBufferDistance` reduction SHIPPED with its measured outcome instead of recommending it
   (§F3.2).
3. **`_tickets/edge-routing06-….md`** — the sweep table, the D3 decision + rationale, the no-bump
   call, and D6.1's three disproved claims (checklist rows 1b / 3b).
4. No `CLAUDE.md` or `docs-internal/architecture-map.md` change is needed — the layering, the
   `view → adapters → engine` direction and the persistence conventions are all unchanged, and
   this feature is a textbook instance of the documented patterns rather than an exception to them.

---

## Answers to the two open `#QUESTION_FOR_HUMAN:` items

### Q1 — missing CHANGELOG entry (existing users' edges re-route 17 → 11 on upgrade)

**Recommendation: write it, and lead with the upgrade effect.** This is not optional polish. Item
(a) — a strictly smaller change — got a full entry; omitting the larger one leaves the changelog
misrepresenting the release. Two things must be in it that a "new slider" bullet would miss:

1. **Existing installs change behaviour with no user action.** The clearance was never persisted,
   so every user is on the old 17 and will silently land on 11: routes tighten and some edges
   re-attach. Nobody can diagnose that from a slider they have never seen.
2. **17px is no longer reachable** — the clamp stops at 14, deliberately, because 17 is the
   pathology. A user who preferred the old look cannot restore it, and should be told so plainly
   rather than discovering it at the end of a slider.

Plus the ordinary content: the 7th slider and where it lives, the measured default and the
`[6,14]` bounds with their two geometric reasons, the dense/facing detour improvements, and the
no-version-bump note (stored settings survive). Leave `:72` as history.

### Q2 — settings-tab sliders have no accessible label (pre-existing, plugin-wide)

**Recommendation: correctly scoped as a separate ticket, and that ticket is already filed** —
`_tickets/settings-tab-sliders-have-no-accessible-label-a11y.md`, landed in `2f61c7d` during this
review. Endorsed: it is pre-existing, affects every tab slider rather than this one, and fixing it
inside a routing ticket would have been scope creep on a change already touching 28 files.

Two things for whoever picks it up: the one-line `slider.sliderEl.setAttribute("aria-label",
meta.label)` in `addForceLayoutSlider` fixes the force-layout sliders only — the same gap exists on
every other `Setting`-rendered slider in the tab, so the fix belongs at whatever shared helper
covers them all. And it should land with a `getByLabel` assertion against the **settings tab**
(today only the in-graph React panel is reachable that way), otherwise it regresses silently the
same way the "six sliders" strings did.

---

## Housekeeping

The mutation worktree `.worktree/rev-b` was removed (`git worktree list` shows only the main
checkout). All probes were written from scratch by me, run inside that worktree, and deleted; no
file under `src/`, `e2e/`, `scripts/`, `README.md` or `_tickets/` was modified by this review.
`.dev-vault` was rebuilt via the documented idempotent script. Logs: `.tmp/rev-b/`.
