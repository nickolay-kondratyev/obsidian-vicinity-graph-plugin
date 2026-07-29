---
id: nid_uv3al1mhaxmz37ooiit15iq0w_e
title: "e2e: facing-side attachment test fails (pre-existing red)"
status: open
deps: []
links: []
created_iso: 2026-07-29T18:06:03Z
status_updated_iso: 2026-07-29T18:06:03Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, edge-routing]
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

