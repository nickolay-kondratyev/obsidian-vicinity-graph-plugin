# PLANNER__PRIVATE — `edge-routing__05` (rehydration memory)

## State

DETAILED_PLANNING done. Plan at `.ai_out/edge-routing__05/main/DETAILED_PLANNING__PUBLIC.md`.
`npm ci` was run (node_modules now present). Probe scripts live in `.tmp/probe*.mjs` — nothing under
`src/`, `e2e/`, `scripts/` was touched.

## The one thing that matters

I **measured** the approved approach and it is a **no-op**. Do not let a later pass quietly reinstate
it. Numbers (real libavoid-js 0.4.5 node build, repo's exact params: buffer 17, segPenalty 50,
crossPenalty 0, shipped 12 `BOUNDARY_PIN_SPECS`):

- Facing-side pin costs (facing 0 / adjacent C / opposite 2C, union over counterparts):
  **0 of 818** group attachments changed across 400 random crowded scenes; 0 of 43 in a systematic
  orbit scan; **still 0 at C = 100 000**. The 24 non-facing attachments are visibility-BLOCKED pins,
  not near-ties. `setConnectionCost` IS live (positive control: cost 100 on the facing side of a
  100×100 box moves the attachment off it) — it just cannot help here.
- `portDirectionPenalty` 0 vs 100: no effect on the blocked case.
- Per-edge **pin CLASS ids** (`ConnEnd(shape, classId)`) are the only per-edge pin lever libavoid has.
  Re-classing the same 12 pins by side: non-facing 24 → 2, routing time identical (409 vs 409 ms).
  But alone it is a net loss: 53/802 routes >50 % longer (lassos), total length +4.8 %.
- **Two passes + keep-the-better** (baseline shared-class pass, facing side-class pass, keep facing
  only if ≤1.25× baseline length): non-facing 24 → **7**, **zero** routes >1.5× longer, total length
  **−0.4 %**. Ratio sweep: 1.0→11 nf, 1.1→9, 1.25→7 (0 lassos), 1.5→7, 2.0→7 but 5 lassos appear.
- `setExclusive(false)` on group pins is MANDATORY for side classes: with the default (directional ⇒
  exclusive) the 4th edge facing one side gets "no pins with class id N" and falls back to the shape
  CENTRE. Latent today too: >12 edges on one group box.
- NEVER register duplicate pins at identical coordinates in two classes — it corrupts routing badly
  (761/802 non-facing, +56 % length). Two class families ⇒ two routers.

## Open with the human (3 questions, verbatim in the plan §1)

1. Path A (two-pass facing classes) vs Path B (harness+fixture+negative result, close) vs Path C
   (ship the no-op as approved). I recommend A, B is the honest PARETO fallback, C is not defensible.
2. Approve `setExclusive(false)` on group boundary pins.
3. If Path B: new ticket `edge-routing__06` or park in research docs?

## Other facts worth keeping

- Phase 0 (eval harness repair) **is** an already-open chore ticket
  `nid_6lxaenl4oamjxqj6f0eh6rr4c_e` — close it, don't duplicate.
- The eval harness does NOT currently print maxDetourRatio/meanDetourRatio even though the controller
  logs them. Adding that readout is mandatory for the ticket's acceptance numbers.
- `scripts/setup-dev-vault.sh` uses `write_if_missing`, so EDITS to existing fixture files never reach
  an existing `.dev-vault`. New fixtures must be NEW paths (`zzfacing-*`).
- Dense fixture is ungrouped ⇒ `needsFacingPass` false ⇒ its numbers must be identical; any movement
  is a bug signal.
- Existing real-wasm facing tests (horizontal/vertical/diagonal) are byte-identical under costs and
  under side classing — expected green, unedited.
- `Avoid.ClusterRef` is not bound on 0.4.5; research doc C1 is wrong about it AND about the cost
  bullet. Plan corrects both in Phase 3.
