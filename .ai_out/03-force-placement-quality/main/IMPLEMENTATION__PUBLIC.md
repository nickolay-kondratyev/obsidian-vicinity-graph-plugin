# IMPLEMENTATION — 03 Force placement quality

## STATUS: BLOCKED — escalating. No production change shipped. See `#QUESTION_FOR_HUMAN` below.

I executed the plan's failing-first Phase 1/2 (built the `strandedHubGraph()`
fixture + the edge-stretch metric over the real elk+d3 pipeline) and then, per the
plan's explicit mandate, iterated the fixture and swept the fix levers to find a
genuine RED. **The empirical result contradicts the plan's root-cause model:** the
prescribed fix (Levers 1–2, pure constants) provably cannot move the metric, and
the metric the plan chose provably cannot detect the real stranding mechanism. I
did **not** fabricate a passing/failing test and did **not** ship an ineffective
constant change. The working tree is pristine (reverted all experiments).

---

## What I built (investigation harness — reverted from the tree, preserved in PRIVATE)

- `strandedHubGraph(crowdCount)` — the Enchiridion mirror the plan specified:
  `main→hub`; `hub`+`sib` in folder `p/ep` (2-member folder-group container, large
  collide radius); `hub→N crowd leaves`; `hub→enchiridion` where enchiridion is a
  degree-1 leaf alone in singleton folder `p/ep/book` (ungrouped root leaf).
- `edgeStretches()` — the plan's edge-stretch ratio computed over the REAL
  projected root edges (`vicinityGraphToElk` → `GraphLayoutRunner.layout` →
  `extractElkPositions`/`extractElkDimensionsById`), exactly:
  `dist(center(s),center(t)) / (collideRadius(s)+collideRadius(t)+D3_FORCE_LINK_GAP_PX)`,
  `collideRadius = hypot(w,h)/2 + D3_FORCE_COLLIDE_PADDING_PX`.

## The empirical evidence (all through the real deterministic pipeline)

### 1. A degree-1 leaf NEVER strands in this metric at a small crowd
`strandedHubGraph` crowd sweep at current defaults (charge −300):

```
crowd=5   ench=0.978  crowdMax=0.974   (all edges < 1.0 — nothing stranded)
crowd=8   ench=0.966  crowdMax=0.975
crowd=12  ench=0.984  crowdMax=0.984
crowd=16  ench=1.058  crowdMax=1.234
crowd=20  ench=0.965  crowdMax=1.308
crowd=24  ench=1.233  crowdMax=1.319
```
The degree-1 leaf's link is already full strength (`1/min(deg)=1`), so `forceLink`
converges its distance to the target ⇒ ratio ≈ 1. The only edges that exceed 1
appear at large crowd and are **collide-ring geometry** (N equal-radius nodes cannot
all sit at one radius around the container), exactly the false-positive the plan
review warned about — not the Enchiridion bug.

### 2. Charge (Lever 2) has ZERO leverage on the metric — decisive charge sweep
Same fixture, overall max edge-stretch and overlaps, charge swept −300 → −30:

```
                    crowd=16              crowd=24
charge=-300   ench=1.058 max=1.234   ench=1.233 max=1.319   overlaps=0
charge=-220   ench=1.050 max=1.234   ench=0.889 max=1.309   overlaps=0
charge=-160   ench=1.046 max=1.234   ench=1.233 max=1.317   overlaps=0
charge=-100   ench=1.040 max=1.234   ench=1.233 max=1.317   overlaps=0
charge=-60    ench=1.036 max=1.234   ench=1.233 max=1.317   overlaps=0
charge=-30    ench=1.034 max=1.234   ench=1.233 max=1.317   overlaps=0
```
`overallMax` is **invariant to charge** (identical to 3 decimals across a 10×
range). The max stretch is set by `forceCollide` (circular, radius = circumscribed
circle), which charge cannot compress. **Lever 2 cannot make any stretch-metric
test go RED→GREEN.** A second, competing-cluster fixture (also plan-suggested) gave
the same result: the leaf rested at ~0.94 for every charge; the only >1 edges were
the other hub's collide ring.

### 3. Lever 1 (pin link strength) — not exercised, as the review already noted
Every non-hub node in every hub-spoke fixture is degree-1 ⇒ strength already 1 ⇒
pinning to 1 changes nothing. Confirmed; no behavioral coverage possible from these
fixtures. (This was flagged in the plan review as a known gap.)

### 4. The REAL mechanism: the folder-group container's circumscribed collide radius
The Enchiridion "long edge" is real, but its cause is neither charge nor link
strength. The `p/ep` container is **192 × 392 px** (two 160px members stacked
vertically by the elk layered pass). Its circular collide radius is
`hypot(192,392)/2 + 20 ≈ 238 px`. Because the hub note is *inside* that container and
every external neighbour links to the *container* (edges are projected onto the
container id), `forceCollide` forces every neighbour ~238px + its own radius from
the container centre. Measured rendered leaf→hub distances:

```
grouped=true   ench->hub=375   crowdToHub=[332,261,414,417,288]   (far AND uneven)
grouped=false  ench->hub=247   crowdToHub=[245,244,241,242,243]   (near AND even)
```
With the hub ungrouped (no container) the leaf sits at 247 and the whole fan is a
tidy equal-radius ring. Grouped, the tall container's circumscribed circle pushes
every neighbour far out at uneven distances, and the lone leaf's long edge crosses
the crowd — precisely the screenshot symptom. **This is a property of the circular
collide approximation applied to a high-aspect-ratio container, and it is
independent of `D3_FORCE_CHARGE_STRENGTH` and `forceLink.strength`.**

## Why the plan is not executable as written

- **Levers 1–2 (the sanctioned, pure-constant fix) cannot fix the bug** — §2/§3
  above prove charge is inert on this metric and link-strength is already 1.
- **The chosen edge-stretch metric cannot even detect the real bug** — it
  normalises by the circumscribed collide radius, so the inflated placement scores
  ≈ 1 (the numerator and denominator both scale with the oversized container). §4.
- **Lever 4 ("tighter link distance for large containers") also cannot fix it** —
  `forceCollide` is circular at the circumscribed radius, so it already forbids any
  neighbour from sitting closer than ~238px from the container centre *regardless of
  link distance*. Shrinking only the link distance does nothing; shrinking the
  collide radius below the circumscribed circle reintroduces box overlaps and would
  fail the existing `overlappingPairCount == 0` regression.

The real fix is architectural, not a constant tune — e.g. (a) a rectangular/AABB
collision force replacing the circular `forceCollide` (so a neighbour approaching a
tall container from the side only clears its half-width, not its diagonal); or
(b) attracting/attaching a cross-boundary edge to the actual member-note position
instead of the container centre; or (c) making containers squarer. Each is a
design change with its own correctness/determinism/overlap test burden and is well
outside "fix defaults / tune constants."

---

## `#QUESTION_FOR_HUMAN`

The approved plan's premise — that the Enchiridion strands due to weak link
strength (Lever 1) and/or high charge (Lever 2), fixable by tuning `constants.ts`,
and detectable by a circumscribed-normalised edge-stretch metric — is empirically
false (evidence above). The genuine mechanism is the **circular `forceCollide`
using the folder-group container's circumscribed-circle radius**, which inflates the
resting distance of *every* external neighbour of a hub that lives inside a tall/
wide container. No pure-constant lever (charge, link strength, link distance) can
fix this without breaking the overlap guarantee, and the chosen metric cannot detect
it.

**Please choose a direction for a re-plan (I did not want to unilaterally undertake
an architectural change against an invalidated plan):**

1. **Rectangular/AABB collision force** (replace circular `forceCollide` with a
   box-aware separation). Highest-fidelity fix; largest change. Would also let me
   write a metric that genuinely goes RED→GREEN.
2. **Edge/attraction target = member note, not container centre** (change the
   projection so the leaf is pulled toward Epictetus's actual box). Medium change in
   `elkMapping.ts` + `d3ForceRefinement.ts`.
3. **Reduce container aspect ratio / size** (e.g. squarer internal layout, or cap
   container collide radius) — smaller effect, may not fully resolve.
4. **Confirm on the real engine first** — reproduce with `FakeLinkProvider` +
   `VicinityEngine.build({outgoingDepth:2})` to verify the mechanism at engine scale
   before committing to a fix (the `makeGraph` reproduction already isolates it, so
   I believe this is confirmatory only).

I recommend **(1)** for a durable fix (it directly removes the over-conservative
circular approximation that is the root cause) or **(2)** as a lighter-weight
Pareto option, but this is a scope/architecture decision for you.

## Test / check status
No production or test files changed (tree pristine); the committed suite remains
green. Nothing to re-verify beyond the untouched baseline. Dev-vault repro data and
CHANGELOG were intentionally NOT added, since no fix shipped — they should land with
the chosen fix so the visual acceptance note references a real code change.

## Files (for the next iteration)
- Investigation harness (fixture + metric + all calibration probes) preserved at
  `.ai_out/03-force-placement-quality/main/IMPLEMENTATION__PRIVATE.md` and
  `.tmp/investigation-harness.test.ts.txt`.
- Root-cause locus: `src/view/d3ForceRefinement.ts` (`forceCollide` at the
  circumscribed radius, `collideRadius = hypot(w,h)/2 + 20`, line ~47/71) +
  `src/view/elkMapping.ts` (`projectedRootEdges`, edges projected onto container id).
