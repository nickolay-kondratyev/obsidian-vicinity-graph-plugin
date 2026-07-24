# EXPLORATION_PUBLIC — `edge-routing__05`

Index of the exploration pass. **Read the three detail files**, this page is only the synthesis.

| File | Covers |
|---|---|
| `EXPLORATION_CODE__PUBLIC.md` | Current routing implementation, pins, telemetry, tests, perf harness, layering |
| `EXPLORATION_BINDINGS__PUBLIC.md` | PREREQ spike: which libavoid-js 0.4.5 APIs are actually bound |
| `EXPLORATION_DOCS__PUBLIC.md` | Research diagnosis (B1/C1), perf cliff, prior tickets __00..__04, prior agent flow |

## PREREQ spike verdict: **NO BLOCKER**

`setConnectionCost`, `setExclusive`/`isExclusive`, `directions`, and `Avoid.portDirectionPenalty`
(enum value 5, set via `router.setRoutingParameter`) are all bound in the pinned `libavoid-js@0.4.5`.
No wasm/WebIDL rebuild. Only `src/view/libavoidLoader.ts` type-narrowing widens.
`Avoid.ClusterRef` is **not** bound (research doc C1's cluster bullet is infeasible — out of scope here).

## The five facts that shape the plan

1. **Cost is the lever; exclusivity is not.** Directional pins already default to
   `isExclusive() === true`, so the 12 group boundary pins are already exclusive — ticket Design
   step 2 is a **no-op**. `setConnectionCost` on facing-side pins is the actual mechanism
   (lower-cost same-class pins are chosen *before* raw path cost).
2. **Note-square pins are the perf pathology.** edge-routing__04 measured 8 pins on ALL shapes at
   **~8838 ms** dense vs ~1450 ms layout (~64×). The current shipped state is 12 pins on group boxes
   only (~137 ms dense). Ticket Design step 3 (4 pins per note) reopens exactly this; it MUST be
   measured, and it must be separable/revertible from step 1.
3. **Note-pin exclusivity gotcha.** If notes get 4 directional pins, each is exclusive by default →
   a note is capped at 4 connectors. Dense hubs would break. Needs an explicit `setExclusive(false)`
   decision.
4. **Pin objects are currently discarded** (`edgeRouting.ts:269`) and are **router-owned** — keep the
   reference to call `setConnectionCost`, but never `destroy()` it (double-free → wasm abort).
5. **The measurement harness is stale.** `e2e/edgeRoutingEval.e2e.ts` still drives removed
   `layered`/`radial` layout modes (`harness.setLayoutMode` writes an ignored field), and its
   "radial routing gated off" assertion can no longer hold. The ticket's acceptance criteria
   (before/after `maxDetourRatio` + routing-vs-layout ms on sparse/medium/dense) depend on this
   harness. Also `ObsidianHarness` is hardcoded to `.dev-vault`, so the ticket's real repro vault
   `.out/public` (Epictetus) cannot be driven by e2e as-is.

## Baselines to beat (edge-routing__04, current shipped state)

| fixture (force) | obstacles | edges | routingMs | layoutMs | maxDetour | meanDetour |
|---|---|---|---|---|---|---|
| sparse | 13 | 10 | 2.9 | 34.4 | not recorded | not recorded |
| medium (5 folder groups) | 21 | 20 | 9.4 | 35.6 | 1.000 | 1.000 |
| dense (ungrouped) | 101 | 292 | 137.2 | 1463.6 | 3.096 | 1.161 |

`crossingPenalty` cliff: 0 → ~140 ms; 100 → ~1700 ms. **Stays 0.**

## Environment note

`node_modules/` is **not installed** in this checkout — IMPLEMENTATION must `npm ci` first.
