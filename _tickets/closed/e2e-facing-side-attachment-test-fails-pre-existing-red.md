---
closed_iso: 2026-07-29T18:45:15Z
id: nid_uv3al1mhaxmz37ooiit15iq0w_e
title: 'e2e: facing-side attachment test fails (pre-existing red)'
status: closed
deps: []
links: []
created_iso: '2026-07-29T18:06:03Z'
status_updated_iso: 2026-07-29T18:45:15Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, edge-routing]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
`e2e/edgeRouting.e2e.ts` — test "WHEN a folder group is crowded from one side THEN no edge attaches on a border facing away from the neighbours" FAILS.

VERIFIED PRE-EXISTING: reproduced on an unmodified checkout (git stash of all work) during nid_niz5dz6uqeyv237ckm15ittqa_e. Baseline failure output:

  Error: edges wrapped past the facing side: facingSide=[top] terminals=[12]
  offFacingTerminals: "right@1210,521", "left@1034,521", ...

So the other test in that file (routing bend + screenshot) passes; only the facing-side property is red. Per that test's own docblock it is the ONLY automated readout of facing-side boundary-pin selection anywhere in the suite, so this is a real coverage hole while it stays red.

Investigate whether the boundary-pin selection regressed (src/view edge routing / facing anchors) or whether the fixture/assertion drifted. Do NOT weaken the assertion without root-causing.

Repro: `npm run test:e2e -- edgeRouting.e2e.ts`

## Acceptance Criteria

The facing-side test passes for the right reason (root cause identified and fixed), or is replaced by an equally strict check after explicit human alignment.

## Resolution (2026-07-29)

**Root cause: the fixture, not the router.** Dumping the live geometry showed the
`facing/` fixture never produced the one-sided crowd its own docs describe. The
`facing-nearN → facing-near1` cluster links are SIBLING links between depth-1
neighbours, and only WALKED links become edges — so at the default outgoing depth 1
they are not edges at all, exert no clustering force, and the 12 neighbours spread
evenly AROUND the box (measured centres: left, right, above and below it). Every edge
attached on the border genuinely facing its own neighbour, i.e. boundary-pin selection
was correct; the assertion's premise ("all 12 neighbours sit off ONE side") was false,
so the test was red from the day it landed. No regression existed.

At outgoing depth 2 (the same device the ring fixture in the same file already uses)
the crowd DOES form — all 12 neighbours above the box, 9 edges competing for the top
side's 3 boundary pins, which is the pin-exhaustion pathology worth guarding. But even
then 3 of 12 neighbours legitimately settle ~180px off the LEFT border, and attaching
those on the flank is the correct routing result — so the "one dominant side" property
is unachievable by construction, not merely unmet.

**Fix (human-aligned, option "per-edge property + depth 2"), commit `f3a5a0c`:**
- `e2e/edgeRouting.e2e.ts` drives the `facing/` fixture at outgoing depth 2 so the
  crowd is real (`WALK_SIBLINGS_DEPTHS`, shared with the ring test).
- The assertion is now PER EDGE: each terminal on the group box must lie on a border
  its OWN counterpart node sits past (`top ⇒ counterpart.cy < box.top`, etc.). It
  still catches the reported pathology (an edge wrapping to the far/unfaced border)
  and no longer asserts a geometry the fixture cannot have. The non-vacuity floor
  (>= 8 terminals) and the readiness poll are unchanged.
- Failure output now names the offending counterpart: `facing-near4.md:left@1040,583`.
- `scripts/setup-dev-vault.sh` fixture docs + the human smoke-check text corrected:
  they claimed depth 1 sufficed, which is exactly the assumption that broke this.

**Verification:** `npm run test:e2e` fully green (92 passed, 1 skipped); `npm test`
(1140) and `npm run check` green. Non-vacuity proven by mutation — flipping the `left`
predicate reds the test and names the three offending terminals.
