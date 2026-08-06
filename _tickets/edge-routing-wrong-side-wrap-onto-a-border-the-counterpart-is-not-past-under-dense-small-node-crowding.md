---
id: nid_izwyr4brgokbnw6equmyfe5xv_e
title: 'edge routing: wrong-side wrap onto a border the counterpart is not past, under
  dense small-node crowding'
status: in_progress
deps: []
links: []
created_iso: '2026-08-04T23:36:35Z'
status_updated_iso: '2026-08-06T20:41:23Z'
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, edge-routing]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Observed while landing content-fit node sizing (ticket nid_cx5zoz7ptucg9nxalibv0mbjb_e): with title-only notes rendering at ~minPx (40px), the `facing/` crowding fixture packs the 12-neighbour blob so tightly against the group box corner that libavoid attaches ONE edge on a border its counterpart is not past.

Measured reproduction (e2e/edgeRouting.e2e.ts facing-side test, before the fixture was re-padded): `facing-near12.md:right@1126,495 centre@1070,237 box@936,436,1126,670` — the neighbour sits clearly ABOVE the box (centre 199px past top, 56px INSIDE right), yet the edge terminated on the right border's 1/4 pin. Each side carries only three boundary pins sharing one cheapest-pin class (`src/view/edgeRouting.ts`, BOUNDARY_PIN_SPECS), so under saturation/obstruction libavoid legitimately picks a wrapped pin.

The fixture (scripts/setup-dev-vault.sh, facing-near*) was re-padded to ~93px nodes so the e2e guard keeps testing the geometry it was tuned for — this ticket tracks the underlying routing behaviour, which real vaults full of small title-only nodes can now hit.

## Acceptance Criteria

With the facing-near* fixture bodies stripped back to one line (nodes at ~40px), the facing-side e2e test (e2e/edgeRouting.e2e.ts "crowded from one side") passes: no terminal on a border its own counterpart is not past.
