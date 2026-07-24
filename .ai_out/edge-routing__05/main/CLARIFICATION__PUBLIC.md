# CLARIFICATION — `edge-routing__05`

Human decisions taken 2026-07-24 after the exploration pass. **These are binding on the plan.**

## D1 — Scope: **Design step 1 only, measure, then decide**

- IN SCOPE: facing-side pin **COSTS** on folder-group boundary pins via
  `ShapeConnectionPin.setConnectionCost()`, computed from the two endpoint rects **before** routing.
  `portDirectionPenalty` (Design step 4) may be used **if it measurably helps** — it is not
  mandatory.
- OUT OF SCOPE (defer to follow-up tickets):
  - Design step 2 `setExclusive(true)` — exploration proved directional pins are **already**
    exclusive by default; it is a no-op. Do not add it.
  - Design step 3 — 4 directional pins per note square. This is the 64× perf pathology
    (8 pins on all shapes = 8838 ms dense). File a follow-up ticket instead.
  - Design step 5 — detourRatio-triggered second routing pass. File a follow-up ticket instead.
- **Acceptance-criterion adjustment (human-approved):** the ticket says "maxDetourRatio drops on
  sparse/medium/dense". The dense fixture is **ungrouped**, so group-pin costs cannot move it, and
  medium is already at 1.000. The criterion becomes:
  **medium/sparse improve or hold at 1.000, and dense must not get worse.**
  Record all before/after numbers in the ticket notes regardless.

## D2 — Eval harness: **repair it as step 0 of this ticket**

`e2e/edgeRoutingEval.e2e.ts` is stale after the force-only layout change: it drives removed
`layered`/`radial` modes through `harness.setLayoutMode()` (which now writes an ignored field), and
asserts "radial routing gated off" — a gate that no longer exists in `src`. Repair it **first**, in
its own commit, so the before/after numbers this ticket depends on are trustworthy. Drop the dead
mode cases and the stale gating assertion; keep the force-only sparse/medium/dense measurements and
the `routingMs < layoutMs` PERF BUDGET gate.

## D3 — Epictetus repro: **add a dev-vault fixture**

Extend `scripts/setup-dev-vault.sh` with an Epictetus-shaped case — a degree-1 note sitting beside a
folder group. The existing `stranded-main` + `p/ep/` fixture is the closest analogue and may be
extended rather than duplicated. This gives a repeatable, source-controlled regression case that e2e
can drive (`ObsidianHarness` is hardcoded to `.dev-vault`). A manual screenshot of the real
`.out/public` vault is still expected as the smoke record, but the fixture is the durable guard.

## D4 — Approach: **Path A, per-edge pin CLASS + keep-the-better two-pass** (supersedes D1's mechanism)

PLANNER measured the D1-approved mechanism against the real libavoid wasm: facing-side
`setConnectionCost` changes **0 of 818 group attachments** across 400 random crowded scenes, and is
still 0 at cost 100 000. `setConnectionCost` itself is live (positive control passes) — the
wrap-arounds are visibility-**blocked** pins, not near-ties. **Design step 1 as originally scoped is
a provable no-op and is therefore abandoned.**

Human approved Path A instead:
- Re-class the same 12 group boundary pins **by facing side** — the class id on
  `ConnEnd(shape, classId)` is the only per-edge pin lever libavoid exposes.
- Run a **baseline pass** and a **facing pass**, and **keep the better route** per edge
  (facing route accepted only when ≤ **1.25×** the baseline length).
- Measured outcome: non-facing attachments **24 → 7**, **zero lassos**, total route length **−0.4%**.
  Re-classing alone (without keep-the-better) was a net loss (53/802 routes >50% longer) and is
  rejected.
- The second pass is **skipped entirely when nothing attaches to a group box**, so the dense
  (ungrouped) perf fixture is untouched.
- **Never co-locate duplicate pins in two classes** — it corrupts routing.

D1's *scope narrowing* still stands: note-square pins and the detour-triggered re-route remain out,
as follow-up tickets. D1's acceptance-criterion adjustment also stands.

## D5 — **`setExclusive(false)` on group boundary pins: APPROVED**

Required by Path A, and applied in **both** passes so the two are comparable. Without it a 4th edge
facing one side silently falls back to the group **centre**. This also fixes a **latent bug that
exists today** at >12 edges on a single group box (the pre-edge-routing__04 pathology).

## Standing constraints (restated, non-negotiable)

- `crossingPenalty` stays **0**.
- **No new settings/knobs exposed** to users.
- No perf regression: routing pass stays well under elk+d3 layout time on the dense fixture.
- Never `destroy()` a router-owned `ShapeConnectionPin`.
- If the existing real-wasm facing-side tests go red, **investigate — do not loosen tolerances**.
