# DETAILED PLAN — 03 Force placement quality: linked nodes stranded far from neighbors

Ticket: `_tickets/03-force-placement-quality-linked-nodes-stranded-far-from-neighbors.md`
Locus: `src/view/d3ForceRefinement.ts` + `src/view/constants.ts` (the static d3-force refinement that places root-level boxes). Read alongside `EXPLORATION_PIPELINE.md`, `EXPLORATION_VAULT.md`, `EXPLORATION_PUBLIC.md`.

---

## 1. Problem understanding

In the Organic (force) layout, a linked node parks far from its link partner, producing a long edge that crosses tightly-linked pairs. Concrete case: `The Enchiridion (The Manual)`, a **degree-1 leaf** whose only edge is to the `Epictetus` hub, lands mid-graph.

**Constraints (from ticket + CLAUDE.md):**
- Fix **defaults / algorithm**, not user settings.
- Keep the pipeline **deterministic** (deterministic elk seed + fixed-seed LCG); repeated runs must stay bit-identical.
- **Start from a failing quality test** over the deterministic pipeline; `npm test` + `npm run check` must pass.
- Bring repro data into `.dev-vault/` — `.out/vaults/public` is not source-controlled.
- New constants get WHY comments; reconcile the existing center-pull WHY comment.

**Critical correction to the ticket's hypothesis #1 (weak link strength):**
The Enchiridion is degree-1. d3's default link strength is `1 / min(deg(source), deg(target))`, so its edge already has strength `1/min(deg(hub),1) = 1` — **full strength**. This holds even if `Epictetus` sits inside a folder-group container that absorbs many edges (the leaf side is still degree 1). So weak link strength does **not** explain *this* node. The plan therefore separates two mechanisms and does not tune against a cause that will not reproduce:

- **Mechanism A — weak link strength** (`1/min(deg)` < 1 when *both* endpoints have degree > 1). Real, but affects hub-to-hub / cross-linked edges, NOT the degree-1 Enchiridion.
- **Mechanism B — charge-vs-attraction equilibrium + static local minimum** (applies to any leaf, incl. degree-1): the resting distance is measured from the hub's (possibly large folder-group container) circumscribed collide-circle, so the leaf rests far; the link force fixes distance but not *angle*; charge (-300) + collide caging from a mediocre elk seed traps the leaf on the wrong side within ~300 ticks. **This is the Enchiridion's mechanism.**

The fix must demonstrably resolve the *actual* stranding (Mechanism B for the acceptance node), while Mechanism A is a legitimate correctness fix worth folding in.

---

## 2. Phase 1 — Root-cause verification FIRST (empirical, before touching constants)

**Goal:** a self-contained fixture that strands a node through the REAL pipeline on CURRENT defaults, plus a metric that quantifies it. No production change in this phase.

**Recommended locus: layout level** — `makeGraph → vicinityGraphToElk → GraphLayoutRunner().layout → extractElkPositions`, extending `src/view/D3ForceLayout.test.ts` (`hubGraph()` / `laidOutBoxes()` pattern). Rationale: tightest, fastest, fully deterministic, and the bug lives in `d3ForceRefinement`. Folder-group containers ARE reachable here (grouping happens in `vicinityGraphToElk`; `MIN_GROUP_MEMBER_COUNT = 2`), so the big-container projection that inflates the Enchiridion's resting distance can be reproduced without the engine.

Use the engine level (`FakeLinkProvider → VicinityEngine.build`) only as a fallback if a hand-built `makeGraph` cannot produce the needed degree/projection topology (not expected).

**Fixture to mirror the Enchiridion (`strandedHubGraph()`):**
- `main.md` (central) → `hub.md` (Epictetus stand-in).
- `hub.md` in folder `p/ep` **with one sibling** (`p/ep/sib.md`, also linked from hub) → the two members make `p/ep` a folder-group **container** (large collide radius), mirroring the real projection.
- `hub.md` → 4–6 plain neighbor leaves (the fan-out crowd, root-level).
- `hub.md` → `p/ep/book/enchiridion.md` — the stranded leaf: **degree-1**, alone in folder `p/ep/book` so it stays an **ungrouped root leaf** (singleton folder, exactly the population `refineForceRootLayout` moves). No other edges.

**RISK — the fixture may NOT strand on current defaults.** Reasoning gives the mechanism but not a guarantee for a specific small graph. Implementation MUST iterate the fixture (increase the neighbor-crowd count, add a second competing cluster the leaf can be pushed into, adjust `sizePx` so the container is genuinely large) **until the metric FAILS on current defaults**, then freeze that fixture. Document in the test WHY the chosen shape is needed. Do not proceed to the fix until the pre-fix assertion demonstrably fails.

**Deliverable:** a red (failing) test + the frozen stranding fixture.

---

## 3. Phase 2 — The quality metric (precise)

**Chosen metric: edge stretch ratio.** For each graph edge `(s, t)` with laid-out box centers:

```
stretch(s,t) = dist(center(s), center(t)) / restingTarget(s,t)
restingTarget(s,t) = collideRadius(s) + collideRadius(t) + D3_FORCE_LINK_GAP_PX
```

`restingTarget` is exactly the distance `forceLink.distance()` drives each edge toward, so a linked pair resting where the force wants it scores `≈ 1`; a stranded pair scores `>> 1`. Self-normalizing (uses each edge's own target), cheap (O(edges)), fully deterministic, and **robust**: judged per-edge, so adding a node / menu item / neighbor cannot break it (unlike an absolute-pixel bound).

`collideRadius` must match production: `hypot(width, height)/2 + D3_FORCE_COLLIDE_PADDING_PX`, using `extractElkDimensionsById` for container/leaf sizes. Centers = `extractElkPositions` top-left + half-dims.

**Rejected alternative** — "each node nearer its link-partner centroid than to any unrelated node": brittle in dense packing (an unrelated box can legitimately sit closer than a partner across a large container) and more code. The stretch ratio captures "stranded / long edge" more directly.

**Assertion shape (BDD, one behavior per test):**
```
GIVEN a hub graph containing a stranding-prone degree-1 leaf
WHEN laid out through the real elk + d3 pipeline
THEN every edge's stretch ratio is <= MAX_EDGE_STRETCH
```
`MAX_EDGE_STRETCH` is a **test-local** named constant (not production), calibrated so the assertion FAILS pre-fix and PASSES post-fix. Recommend starting near `2.0` and tightening only as far as the fix reliably clears with margin. Keep the existing `overlappingPairCount == 0` and determinism tests intact as companions (do not fold multiple behaviors into one test).

---

## 4. Phase 3 — The fix (priority order, minimal set)

Apply the **smallest** set the metric proves necessary. Each lever below lists the mechanism it addresses.

### Lever 1 (baseline, always) — pin `forceLink.strength` to a constant `~1`
- **Addresses:** Mechanism A. Reconciles the false assumption in the `D3_FORCE_CENTER_PULL_STRENGTH` WHY comment ("must stay well below the link strength (~1)"), which is only true if strength is actually pinned.
- **Change:** add `D3_FORCE_LINK_STRENGTH = 1` (or 0.9) in `constants.ts`; call `.strength(D3_FORCE_LINK_STRENGTH)` on `forceLink` in `d3ForceRefinement.ts`.
- **PRO:** tiny, deterministic, makes the documented model true, fixes general degree>1 stranding. **CON:** does NOT change the degree-1 Enchiridion's forces (already effectively 1) → may not, alone, satisfy the visual acceptance.
- **Determinism:** unaffected (pure constant).
- **NOTE — Lever 1 is NOT exercised by either fixture.** In `hubGraph()` and the proposed `strandedHubGraph()` every non-hub node is degree-1, so its link strength is *already* `1/min(deg)=1`. Pinning to 1 leaves both fixtures' layouts bit-identical, so **the stretch-metric test proves nothing about Lever 1 — the metric is driven entirely by Lever 2 (charge).** Ship Lever 1 as an explicitly-reasoned correctness / doc-reconciliation fix for real multi-degree vault edges (which the hub-spoke fixtures do not model), NOT as something the new test covers. Alternative if you want it test-backed: add a small Mechanism-A fixture (an edge whose BOTH endpoints are degree>1, e.g. a cross-linked pair) that strands pre-pin and packs post-pin — but that is arguably over-scope for this Mechanism-B ticket; a follow-up ticket is the Pareto call. Do not let the "failing-first" ritual confuse you into expecting Lever 1 to move the metric — it will not.

### Lever 2 (the degree-1 lever) — moderate charge reduction
- **Addresses:** Mechanism B. Lower repulsion → the crowd packs tighter and the tethered leaf settles nearer its target, with fewer unrelated boxes between partners to cross.
- **Change:** `D3_FORCE_CHARGE_STRENGTH` from `-300` toward `~ -150..-180` (calibrate against the metric). Update its WHY comment (currently "deliberately moderate … a strong charge would re-create the dispersion").
- **PRO:** the most direct fix for the charge-driven degree-1 case; still a pure constant (determinism-safe). **CON:** less untangling can, in principle, raise overlaps/crossings on dense hubs — **must re-verify `overlappingPairCount == 0`** on `hubGraph()` and the new fixture. Contradicts the prior "moderate" tuning, so document the new rationale.

### Lever 3 (only if 1+2 insufficient) — more relaxation
- **Addresses:** Mechanism B (angular local minimum). Slow `alphaDecay` (more ticks) or add a single deterministic re-heat pass so the static run escapes the seed's local minimum.
- **CON:** more compute + moving parts; determinism care (any re-heat must reuse `seededRandom()`; the tick-count formula `ceil(ln(alphaMin)/ln(1-alphaDecay))` must stay self-consistent). Prefer NOT to touch unless needed.

### Lever 4 (last resort) — tighter link distance for large containers
- Shorten the inflated resting distance by using a tighter radius than the full circumscribed circle for big containers.
- **CON:** couples link/collide geometry; risk of `linkDistance < collideRadius` → overlaps. Avoid unless 1–3 fail.

**Recommendation:** Lever 1 + (if the metric on the Enchiridion-mirroring fixture still fails) Lever 2. Hold Levers 3–4 in reserve. This is the KISS/Pareto path: two pure-constant changes, determinism trivially preserved, both mechanisms covered.

**WHY-comment obligations:**
- New `D3_FORCE_LINK_STRENGTH`: explain that d3's default `1/min(deg)` silently weakens hub-adjacent links exactly where "linked boxes sit close" must hold, and that pinning near 1 keeps it dominating the 0.05 centre pull.
- If charge changes: rewrite the `D3_FORCE_CHARGE_STRENGTH` WHY to state the new balance and note collide (not charge) prevents overlaps.
- Reconcile `D3_FORCE_CENTER_PULL_STRENGTH`'s WHY so its "link strength (~1)" reference points at the now-real `D3_FORCE_LINK_STRENGTH`.

---

## 5. Phase 4 — Regression safety

Existing behavior that MUST still pass (do not weaken):
- `src/view/D3ForceLayout.test.ts`: `overlappingPairCount(...) == 0` on `hubGraph()` (Lever 2 risk — re-verify), determinism (`laidOutBoxes` twice `toEqual`), folder-group container dimensions + members-stay-inside-container (d3 only moves whole boxes → unaffected, but confirm).
- `src/view/ElkLayout.test.ts` determinism (elk seed untouched).
- `npm run check` (strict TS: `noUncheckedIndexedAccess`, `noImplicitReturns`).

New test must be robust: per-edge normalized ratio (not absolute px), so unrelated fixture growth cannot break it.

---

## 6. Phase 5 — Dev-vault repro data (manual visual acceptance only)

**Reading confirmed:** the deterministic **automated regression is the self-contained `makeGraph` fixture** (Phase 1); the **dev-vault notes exist only for the manual visual check** in the acceptance criteria. `.out/vaults/public` is not source-controlled, so mirror the Epictetus subgraph into the dev vault.

Add notes via **`scripts/setup-dev-vault.sh`** `write_if_missing` blocks (source-controlled, idempotent; `.dev-vault/` itself is gitignored, so the script is the source of truth). Use **bare-basename wikilinks** (repo convention). Mirror topology:
- `we-have-a-finite-amount-of-time.md` (open this note for the check) → `[[memento-mori]] [[you-will-die]] [[regret-minimization]] [[Epictetus]]`.
- `p/Epictetus/Epictetus.md` → `[[philosopher-of]] [[stoicism]] [[author-of]] ![[The-Manual-Enchiridion]] ![[th]]` (hub fan-out).
- `p/Epictetus/book/The-Manual-Enchiridion.md` — the stranded leaf, **alone in `p/Epictetus/book/`** (singleton folder → ungrouped leaf).
- Stub notes for the link targets so the fan-out exists. Requires `outgoingDepth >= 2` to surface Enchiridion (engine default is 1; the reviewer must set depth to 2 in the view for the visual check — call this out in the acceptance note).

---

## 7. Acceptance-criteria mapping

| Ticket criterion | Deliverable |
|---|---|
| New quality test/eval **fails on current defaults, passes after fix** | Phase 1 fixture + Phase 3 metric test (edge-stretch `<= MAX_EDGE_STRETCH`) in `D3ForceLayout.test.ts`; verified red before fix, green after |
| Visual: Enchiridion sits adjacent to partners, no long stranded edges | Phase 5 dev-vault subgraph, opened at `outgoingDepth = 2`, checked by human/e2e after the fix |
| Layout deterministic; `npm test` + `npm run check` pass | Phase 3 keeps seeded LCG + elk seed; fix is pure-constant (Levers 1–2); Phase 4 reruns existing determinism/overlap tests + `tsc` |

---

## 8. Files to change (with rationale)

1. `src/view/constants.ts` — add `D3_FORCE_LINK_STRENGTH` (+ WHY); if Lever 2 used, adjust `D3_FORCE_CHARGE_STRENGTH` (+ rewrite WHY); reconcile `D3_FORCE_CENTER_PULL_STRENGTH` WHY. *Single source of tuning constants.*
2. `src/view/d3ForceRefinement.ts` — add `.strength(D3_FORCE_LINK_STRENGTH)` to `forceLink`; (only if Lever 3) alphaDecay/re-heat with determinism care. *The layout locus.*
3. `src/view/D3ForceLayout.test.ts` — new failing-first BDD stretch-metric test + `strandedHubGraph()` fixture + `edgeStretchRatios` helper (reuse `laidOutBoxes`, `extractElkDimensionsById`). *Colocated regression.*
4. `scripts/setup-dev-vault.sh` — idempotent `write_if_missing` Epictetus/Enchiridion notes. *Reproduce without `.out/vaults/public`.*
5. `docs-internal/CHANGELOG.md` + ticket closure — per repo conventions.

**Testing strategy:** BDD `WHEN … THEN …`, one behavior per test, colocated `*.test.ts`, minimal mocking (real elk + d3 headless via `GraphLayoutRunner`, no React/DOM/obsidian). Start red, then green. Keep existing overlap/determinism/containment tests as untouched regression guards.

---

## 9. Pushback / simplifications
- Do **not** reach for Levers 3–4 or any re-heat/alphaDecay change unless Levers 1–2 provably fail the metric — they add determinism-sensitive complexity for marginal gain (anti-Pareto).
- Do **not** build a Playwright screenshot eval for the automated gate — a Vitest edge-stretch metric over the real pipeline is deterministic, faster, and sufficient. Reserve Playwright for the manual visual acceptance.
- Do **not** encode absolute-pixel thresholds; the normalized stretch ratio is the robust, future-proof metric.

---

## Resolved — dev-vault mirror sanctioned (was #QUESTION_FOR_HUMAN)
The visual acceptance criterion references `.out/vaults/public/we-have-a-finite-amount-of-time.md`, which is not source-controlled. **RESOLVED by the ticket itself**, which explicitly instructs: "bring in the required test data into the dev-vault to be able to reproduce this issue without the `.out/vaults/public` dependency." The mirrored `.dev-vault/` subgraph (via `setup-dev-vault.sh`, opened at `outgoingDepth = 2`) is the sanctioned substitute for the visual check; the automated deterministic gate is the self-contained `makeGraph` fixture regardless. No human confirmation needed — proceed.
