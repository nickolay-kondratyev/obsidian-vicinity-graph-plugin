# Plan Review — `edge-routing__05` (DETAILED_PLANNING, Path A)

Reviewer ran every probe under `.tmp/` against the real `libavoid-js@0.4.5` wasm and wrote three
additional probes (`.tmp/probe11-reviewer.mjs`, `.tmp/probe12-reviewer.mjs`, `.tmp/probe13-reviewer.mjs`)
to test claims the plan does not test. Nothing under `src/`, `e2e/`, `scripts/` was modified.

## Executive Summary

**No blocking issue. The negative result is trustworthy — I reproduced it exactly.** The plan is
unusually well-evidenced, correctly layered, and its riskiest mechanics (pin lifetime, E8
co-location, telemetry honesty, cache soundness) hold up under checking. **But the headline numbers
were measured in a configuration that is not the configuration the plan ships**, and two things the
plan asserts as settled are not: (a) how much of the win is bought by the one-line
`setExclusive(false)` versus the ~120-line second pass, and (b) whether the 1.25× threshold can
satisfy CLARIFICATION D1's binding acceptance bar at all. Both need a re-measure and one human call
before implementation. Verdict: NEEDS_ITERATION — the approach survives, the evidence base and the
phasing need repair.

## Verification performed (the highest-value check first)

**The negative result reproduces byte-for-byte.** All numbers below are my re-runs, not the plan's:

| Probe | Plan claims | I measured |
|---|---|---|
| probe3 | 0/43 attachments changed by facing cost | `changed by cost: 0/43` |
| probe5 | 0 of 818 changed at cost 250 | `scenes=400 edges=818 scenesChangedByCost=0`, non-facing 23 → 23 |
| probe6 | still 0 at cost 100 000 | `shared+cost0=24 shared+cost100000=24 per-edge-CLASS=2` |
| probe8 | class alone is a net loss | `>50% longer=53`, total length `+4.8%` |
| probe9 | keep-better @1.25 → 7 non-facing, −0.4% | exactly reproduced, incl. the full ratio sweep |
| probe10 | exclusive pins → centre fallback | reproduced |

Methodology is sound where it matters: the cost is set on the constructed pin *before*
`processTransaction`, pins are never recreated after the cost is applied, the class ids match, and
probe2's positive control uses the identical call path. **E1–E3 stand. Design step 1 is a proven
no-op and abandoning it is correct and honest.**

---

## Critical Issues (BLOCKERS)

None.

---

## Major Concerns

### M1 — The headline numbers were measured in a configuration the plan does not ship

`probe8`/`probe9` — the sole source of "non-facing 24 → 7, zero lassos, −0.4%" — differ from the
planned design in **two** ways:

1. **`setExclusive(false)` is never called** in probe8/probe9 (they construct the pin and drop it).
   The plan mandates it in **both** passes. So neither the measured baseline nor the measured facing
   pass is the pass that will ship.
2. **The facing rule used is not total.** probe9's `dominantRule` returns `SHARED` when the rects
   overlap — and the group shape has **no class-1 pins** in that mode, so libavoid emits
   `ConnEnd::assignPinVisibilityTo: … no pins with class id of 1` and drops those edges to the shape
   **centre**. Those warnings are visible in my re-run. The plan's §3.2 rule 5 explicitly fixes this,
   which means the shipped rule routes the overlap cases differently from what was measured.

**Impact:** the 1.25 constant, the "zero lassos" claim and the −0.4% are all quoted from a
configuration that will not exist after Phase 2. **Recommendation:** re-run the ratio sweep with
`setExclusive(false)` in both passes and the total `facingSideOf`, and quote *those* numbers in
§3.3 and the ticket notes. I have already done this (below) — the conclusions shift materially.

### M2 — `setExclusive(false)` alone delivers a large fraction of the win, for one line

The plan frames `setExclusive(false)` purely as a prerequisite ("without it the 4th edge falls back
to centre"). It is much more than that. Measured with the planned configuration
(`.tmp/probe11-reviewer.mjs`, same scene generator, same seed):

| variant | low degree (1–3 edges/group, 802 edges) | higher degree (1–7 edges/group, 1668 edges) |
|---|---|---|
| **A** = today (shipped) | non-facing **24** | non-facing **82** |
| **B** = shared class + `setExclusive(false)` — **one line, single pass** | non-facing **22**, length −0.3% | non-facing **40**, length **−2.3%** |
| **C** = side classes + `setExclusive(false)` (facing pass alone) | non-facing 2, length +0.7% | non-facing 2, length −1.7% |
| **KB** = keep-better(B, C) @1.25 — **the full plan** | non-facing **7**, length −0.9% | non-facing **13**, length −2.7% |

At the degree a real folder group actually sees, **`setExclusive(false)` alone closes 42 of the 69
improvement (61%) for ~1 line of code and zero extra routing work.** The remaining ~27 costs a
second router pass, a selection rule, a new constant and ~120 lines.

**Impact:** this is exactly the PARETO question the prior flow's lesson was about (data-level edits
beat new abstractions), and the plan cannot answer it because it never measured B. **Recommendation:**
split Phase 2 into **2a = `setExclusive(false)` only** (own commit, own measurement, own real-wasm
test — it is independently valuable and fixes the latent E9 bug) and **2b = the facing pass** (own
commit, measured *incrementally against 2a*). This makes attribution honest, gives the human a real
stop point, and does not change the end state if both land.

### M3 — The 1.25× threshold is in direct conflict with D1's binding acceptance bar

D1 fixes the bar at "medium `maxDetourRatio` improves or **holds at 1.000**". `detourRatio` is
routed length ÷ endpoint chord. `chooseRoutes` at 1.25 **deliberately accepts routes up to 25%
longer than the baseline**. Medium is currently 1.000 (every route straight). If the facing pass
wins a single edge there with a 1.2× route, `maxDetourRatio` goes to ~1.2 and **the plan fails its
own binding acceptance criterion** — not by a bug, but by design. The plan does not acknowledge this
anywhere; §5's pass/fail table restates the bar as if the two were compatible.

Measured against the honest (non-exclusive, total-rule) baseline, `.tmp/probe13-reviewer.mjs`:

| ratio | low degree | higher degree | edges longer than baseline | worst per-edge ratio |
|---|---|---|---|---|
| **1.0** ("keep the shorter route") | non-facing **10**, −0.7% | non-facing **22**, −0.8% | **0** | **1.00** |
| 1.1 | 9, −0.7% | 18, −0.7% | 30 | 1.10 |
| **1.25** (planned) | 7, −0.6% | **13**, −0.4% | 54 | 1.25 |
| 1.5 | 7, −0.6% | 12, −0.2% | 59 | 1.47 |

**ratio = 1.0 needs no constant at all** ("keep the shorter route"), cannot raise `maxDetourRatio` on
any edge, and therefore satisfies D1 by construction — at the cost of 9 fewer facing fixes in 1668
edges. **But** the Epictetus symptom is precisely a case where the facing route is *longer* (that is
why libavoid rejected it), so ratio 1.0 plausibly does **not** fix the screenshot. The metric the
ticket accepts by and the outcome the ticket wants are pulling in opposite directions.
**Recommendation:** do not silently ship 1.25 against a bar it can violate — surface the conflict
(see `#QUESTION_FOR_HUMAN` below) and, whichever way it goes, verify on the actual Epictetus fixture
which ratios flip that edge before locking the constant.

### M4 — "The dense fixture is untouched" is a fixture artifact, not a user guarantee

True and verified: dense is ungrouped, `needsFacingPass` is false, cost is 0 extra ms. But
`groupByFolder` is the **default**, so a real dense vicinity *with* folder groups is the common case,
and it pays a **full second pass** — and no fixture in the suite exercises that path at scale. The
plan therefore satisfies the letter of "no perf regression on the dense fixture" while leaving the
two-pass cost unmeasured at the only scale where it could matter.

Order of magnitude from my runs: the two passes cost the same (386 ms vs 372 ms over 400 scenes), so
a grouped dense vicinity would go ~137 ms → ~274 ms against ~1460 ms layout — still comfortably
inside the budget, which is reassuring but should be *measured*, not inferred.
**Recommendation:** make the new Phase 1 fixture grouped-and-dense enough to exercise pass 2 (or add
one `zzdense-grouped-hub` case), and record its `routingMs` in the BEFORE/AFTER tables.

### M5 — Phase 1's fixture cannot fail, and the plan says so

Phase 1 §4 already admits "force layout decides where the leaf lands, so this fixture cannot
guarantee it reproduces the wrap". A regression fixture that may or may not contain the regression is
not a guard. The plan compensates with the Phase 2 real-wasm test, which is the right call — but then
the e2e fixture's actual job is *screenshot smoke + aggregate detour*, not regression.
**Recommendation:** say that plainly in the phase goal and drop "durable regression case" framing, so
a later reader does not trust it as one. (Left for iteration rather than edited inline, because it
touches the phase's stated purpose.)

---

## Simplification Opportunities (PARETO)

- **Ship 2a alone and stop, if the human judges it enough** (M2). One line, 82 → 40 non-facing at
  realistic degree, −2.3% total length, removes a latent centre-fallback bug, and requires **no**
  second pass, **no** constant, **no** `chooseRoutes`, **no** `facingSideOf`. This is by a wide
  margin the best value-per-line in the whole ticket and the plan currently hides it inside a
  prerequisite bullet.
- **`maxRatio = 1.0` removes the constant entirely** (M3) and turns `chooseRoutes` into "keep the
  shorter route" — no magic number, no sweep to justify, no spec-lock test, no D1 conflict. Only
  adopt if the Epictetus edge still flips; otherwise 1.25 with a renegotiated bar.
- Everything else in the plan is already at the right altitude. I found no other machinery to remove.

## Minor Suggestions — **applied inline to `DETAILED_PLANNING__PUBLIC.md`**

1. **`chooseRoutes` degenerate-facing guard (§3.2).** As written, a facing route with <2 points has
   length 0 and would *always* win the comparison, publishing a broken edge. Eligibility is now
   `facing.length >= 2 && (baseline.length < 2 || facingLen <= baselineLen * maxRatio)`. Test bullet
   added to §6.1. probe6 measured `degenerateRoutes = 0`, but the guard must not depend on that.
2. **E9 corrected (§0).** ">12 attached edges" understates the latent bug by ~3×: a pin is only
   reachable from the direction it faces, so the real limit is **≥4 edges approaching one side**
   (3 pins/side). probe10's shipped-configuration run puts **5 of 8** left-approaching edges on the
   group centre — today.
3. **Subset-routing invariant documented (§3).** Routing only the group-attached edges in pass 2 is
   sound *only* because `crossingPenalty === 0` and the pins are non-exclusive. Silently breakable;
   now called out as a required WHY comment.
4. **Length-only selection metric justified (§3.2).** I tested the obvious objection (the router
   itself prices bends at `segmentPenalty = 50`, the selection rule ignores them): a bend-aware
   metric disagrees on **2/802** and **9/1668** selections and is marginally *worse* on non-facing
   count. Recorded so this is not re-litigated later.
5. **Diagonal tie-break is live in an existing test (§3.2 rule 3).** `boxL(0,0,100,100)` /
   `boxR(300,300,100,100)` is an *exact* horizontal/vertical tie, so rule 3 decides which class the
   corner-clearance test exercises. It still passes (side pins sit ≥25px from a corner vs
   `CORNER_CLEARANCE_TOL_PX = 12`), but by design rather than luck now.

## Compliance with binding decisions and standing constraints

| Item | Status |
|---|---|
| D1 mechanism (facing pin costs) | Correctly abandoned; superseded by D4. Evidence verified. |
| D1 scope narrowing (no note pins, no detour re-route) | Honoured; both filed as follow-ups (§8.1, §8.5). |
| D1 acceptance bar (medium holds at 1.000) | **At risk — see M3.** |
| D2 harness repair as step 0 | Honoured; all staleness claims verified accurate (`LayoutMode` line 31, `setLayoutMode` line 298, radial gate assertion line 180). Correctly folded into the existing open chore ticket rather than duplicating it. |
| D3 dev-vault fixture | Honoured; the `write_if_missing` reasoning for adding *new* paths instead of editing `stranded-main` is correct (verified `scripts/setup-dev-vault.sh:22-23`). |
| D4 Path A | Followed. |
| D5 `setExclusive(false)` both passes | Followed — but never measured (M1/M2). |
| `crossingPenalty` stays 0 | Yes, untouched. |
| No new user settings | Yes — both new values are module constants. |
| Never `destroy()` a router-owned pin | Yes. §3.4 is correct: the pin is a local `const`, never entering `AvoidArena.owned`; Emscripten wrappers free nothing on GC, so there is no leak and no double-free path. Each pass owns and disposes its own arena, sequentially. |
| Never loosen `FACING_BORDER_TOL_PX` / `MID_SPAN_TOL_PX` / `CORNER_CLEARANCE_TOL_PX` | **The plan nowhere permits loosening a tolerance.** §4 Phase 2.4 and §6.2 both state the opposite explicitly ("investigate — do not touch"). Clean. |

## Answers to the specific review questions

- **Route cache correctness.** Sound. `routingSignature` keys on obstacle geometry + edge endpoints;
  the facing pass derives *entirely* from those plus `RoutingObstacle.kind`. `kind` is **not** in the
  signature, but group ids are folder paths and note ids are vault paths — disjoint namespaces — so
  id → kind is a function and the signature stays a complete key. Worth one sentence in the plan; not
  worth a code change.
- **Telemetry honesty.** Verified: `routeStart` … `durationMs` in `GraphViewController.ts:261-263`
  wraps `await this.edgeRouter.route(input)`, and *both* passes live inside `route()`. The second
  pass cannot hide from the perf log. The dense gate genuinely never triggers pass 2 (dense fixture
  is ungrouped → no `folder-group` obstacle → `needsFacingPass` false).
- **E8 "never co-locate duplicate pins".** Enforced structurally, not just stated: one pin per
  `BOUNDARY_PIN_SPECS` entry per pass, class chosen by the pass `mode`. Good design.
- **Testability.** Strong. Every new decision (`facingSideOf`, `PIN_CLASS_BY_SIDE`,
  `needsFacingPass`, `chooseRoutes`) is a pure function with wasm-free BDD tests mirroring the
  `BOUNDARY_PIN_SPECS` spec-lock pattern, and Phase 2 starts from a RED real-wasm test. `needsFacingPass`
  being unit-testable without wasm is what makes the dense perf guarantee assertable — a nice touch.
- **Phasing / follow-ups.** Commit split is sensible and the deferred items (note-square pins,
  detour-triggered re-route, `arrows.md` staleness, `ObsidianHarness` vault hardcoding, missing
  `detourStats` test) are all captured. Only change requested is the 2a/2b split (M2).

## Strengths

- The pivot itself. Measuring the approved mechanism against the real wasm *before* implementing it,
  finding it inert, and refusing to ship a plausible-sounding no-op is exactly `EARN_TRUST`. The
  probes are re-runnable and reproduce exactly; the positive control (probe2) is the right control.
- E8 and E7 are genuinely non-obvious wasm hazards found by experiment, not by reading docs.
- §3.1 states the crux honestly — class id is a *hard filter*, and the second pass is what converts
  it back into a soft preference. That paragraph is the single most valuable artifact of this ticket.
- Tolerance discipline is exemplary: two separate places pre-commit to investigating rather than
  loosening.
- Correcting `research-layout-aesthetics.md` §C1 *in this ticket* rather than deferring it (Phase 3.4)
  is the right call — that doc is what generated this ticket.
- Path B is offered as a real, costed option rather than a strawman.

---

## `#QUESTION_FOR_HUMAN` items

> `#QUESTION_FOR_HUMAN: D1's acceptance bar ("medium maxDetourRatio improves or holds at 1.000") is in direct conflict with the approved 1.25x keep-the-better rule, which by design accepts routes up to 25% LONGER than baseline — on medium, where every route is currently straight (1.000), a single accepted facing route would push maxDetourRatio to ~1.2 and fail the bar. Measured options: (a) keep 1.25 and replace the bar with "non-facing attachment count strictly decreases AND no edge exceeds 1.25x its baseline length" (facing 82->13 at realistic degree, total length -0.4%); (b) drop the constant entirely and keep the SHORTER route (ratio 1.0) — satisfies the old bar by construction, needs no magic number, but yields 22 non-facing instead of 13 and may NOT fix the Epictetus edge, since a wrap-around wins precisely when the facing route is longer. Which bar do you want?`

> `#QUESTION_FOR_HUMAN: setExclusive(false) alone — one line, no second pass, no new constant — measures 82 -> 40 non-facing attachments and -2.3% total route length at realistic group degree; the full two-pass design takes it to 13 for ~120 more lines and a doubled routing pass on grouped vicinities. Do you want Phase 2 split into 2a (setExclusive(false) only, measured and committed on its own) and 2b (the facing pass, measured incrementally against 2a), with the option to stop after 2a?`

---

VERDICT: NEEDS_ITERATION (major feedback follows)
