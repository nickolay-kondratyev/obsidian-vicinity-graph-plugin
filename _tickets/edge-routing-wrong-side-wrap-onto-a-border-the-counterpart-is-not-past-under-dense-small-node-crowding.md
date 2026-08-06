---
id: nid_izwyr4brgokbnw6equmyfe5xv_e
title: 'edge routing: wrong-side wrap onto a border the counterpart is not past, under
  dense small-node crowding'
status: punted
deps: []
links: []
created_iso: '2026-08-04T23:36:35Z'
status_updated_iso: 2026-08-06T20:53:02Z
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

## Resolution status (2026-08-06) — PUNTED into parked research

**The acceptance premise is now stale, and the underlying routing defect is unfixed.**

What was done:
- Stripped the `facing-near*` fixture bodies back to one line (`scripts/setup-dev-vault.sh`) and rebuilt `.dev-vault`.
- The facing-side e2e test (`e2e/edgeRouting.e2e.ts` "crowded from one side") **passes** — deterministically, terminals=12, zero wrong-side.

Why the acceptance no longer means what it says:
- A one-line note no longer renders at ~40px. Content-fit sizing refinement `b191c1d` (floor/fit against the node's OWN chrome), which landed AFTER this ticket was filed, floors a title-only note to **~89x34** — essentially the same ~93px the artificial padding used to force. So the padding was redundant; removing it keeps the guard testing its tuned crowd geometry, and it stays green **without any routing change**.
- The `(nodes at ~40px)` in the acceptance is therefore not produced by "one-line body" anymore.

The underlying defect IS still real, just not reachable from a one-line body at today's sizing:
- Real-wasm probe (one-sided crowd of 40x40 squares above a 200×240 folder-group box, shipped clearance 11) reproduced a wrong-side wrap: a node whose centre sits ABOVE the box terminated on the RIGHT border.
- Root cause (already measured, `docs-internal/research/facing-side-edge-attachment.md` §1): these are visibility-BLOCKED pins, not near-ties — the shape buffer seals the facing corridor under crowding. **Cost-model tweaks provably cannot fix it** (0/818 attachments moved even at cost 100 000; `portDirectionPenalty` no effect). The only known robust fix is the **parked two-pass per-side-class design** (§2), explicitly gated behind revisit triggers not yet met, and flagged as needing full re-measurement before anyone builds it.

Decision needed (see `.ai_out/_current_decision/current_decision.md`): this ticket is folded into that parked research (its first revisit trigger — "wrap-arounds still a complaint" — is what materialised here). Set to `punted`. Reopen / merge into the ticket that builds the two-pass only when a ~40px wrap becomes a real user-facing complaint.

## Notes

**2026-08-06T20:53:02Z**

Punted: e2e acceptance met after fixture strip (one-line notes now render ~89px via b191c1d, not 40px); underlying ~40px wrap confirmed still present via real-wasm and folded into docs-internal/research/facing-side-edge-attachment.md. Awaiting human decision in .ai_out/_current_decision/current_decision.md.
