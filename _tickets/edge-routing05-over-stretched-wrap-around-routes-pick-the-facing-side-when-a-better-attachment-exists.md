---
id: nid_4lmhpfc64eb4auw27wqis8wqe_e
title: "edge-routing__05: over-stretched wrap-around routes - pick the facing side when a better attachment exists"
status: open
deps: []
links: []
created_iso: 2026-07-24T22:09:21Z
status_updated_iso: 2026-07-24T22:09:21Z
type: feature
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [edge-routing, layout, aesthetics]
---

2026-07-24 clear-goals dev-vault screenshot: Epictetus sits directly LEFT of the folder-group box, yet its edge detours and attaches at the group BOTTOM - an over-stretched route although a short facing-side attachment exists. Full diagnosis: docs-internal/notes/research-layout-aesthetics.md (sections B1, C1).

Root cause (routing IS active - this is pin-choice, not missing routing):
- The 12 group boundary pins share one class at EQUAL cost; libavoid minimizes path cost only, never "prefer the side facing the counterpart".
- Crowded corridors (17px shapeBuffer per obstacle) make facing-side pins expensive/unreachable -> router wraps to another side.
- Note squares have a single ConnDirAll CENTRE pin, so the other endpoint is side-agnostic too.
- detourRatio telemetry already flags these routes (GraphViewController detourStats) but nothing acts on it.

HARD CONSTRAINT: no perf regression. crossingPenalty stays 0 (its cost is a cliff, incurred for ANY positive value - see docs-internal/research/crossing-penalty-and-worker-offload.md). Routing pass must stay well under the elk+d3 layout time on the dense dev-vault fixture (edge-routing__03 budget).

## Design

Approaches, in intended order (all parameter/API-level on the libavoid we already ship):
1. Facing-side pin COSTS: compute the facing side from the two endpoint rects BEFORE routing; ShapeConnectionPin.setConnectionCost() makes same-class pins on the facing side cheaper (libavoid prefers lower-cost pins before raw path cost).
2. Exclusive pins: setExclusive(true) (directional pins are exclusive by default in libavoid) - one connector per pin spreads attachments along the border instead of piling into one corridor.
3. Note squares: replace the single centre pin with 4 directional side pins (one per side, same class). 12-per-note blew the edge-routing__04 Phase A budget; 4 is the middle ground - MEASURE on the dense fixture.
4. portDirectionPenalty > 0 so approaching a pin against its declared direction costs extra.
5. Fallback if 1-4 underdeliver: post-check any clipped route with detourRatio > THRESHOLD, re-route ONCE with pins restricted to the facing side, keep the shorter.

PREREQ / RISK: verify the libavoid-js WebIDL bindings expose setConnectionCost / setExclusive / portDirectionPenalty; if not, the bindings must be extended (Aksem/libavoid-js README says extending WebIDL is on the consumer). Spike this FIRST.

Testability: facing-side computation + pin-spec selection are pure functions -> unit test without wasm (same pattern as BOUNDARY_PIN_SPECS). Route quality is verified numerically via the existing detour telemetry on dev-vault fixtures + screenshot smoke run.

## Acceptance Criteria

- Epictetus-style case (neighbor directly beside a group box) attaches on the facing side, no wrap-around.
- maxDetourRatio on the sparse/medium/dense dev-vault fixtures drops vs baseline (record before/after in ticket notes).
- Routing pass duration stays well under elk+d3 layout time on the dense fixture (log both).
- crossingPenalty remains 0; no new settings/knobs exposed.
- Pure pin-selection logic unit-tested; screenshot smoke run recorded.


## Appendix
Vault with notes `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2/.out/public`

from note 'clear-goals.md' produces a view as `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2/.tmp/Screenshot From 2026-07-24 15-41-26.png` Notice how Epictetus is awkwardly linked to the bottom from the bottom of the group creating odd relationship. 