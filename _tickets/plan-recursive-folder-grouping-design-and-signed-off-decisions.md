---
closed_iso: 2026-08-14T00:19:07Z
id: nid_xko67wo2z4awg5gdrm1xx1chz_e
title: "PLAN: Recursive folder grouping - design and signed-off decisions"
status: closed
deps: []
links: []
created_iso: 2026-08-14T00:17:07Z
status_updated_iso: 2026-08-14T00:19:07Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

# Plan: Recursive folder grouping

Origin ticket: `nid_4ntyhn708ycqnzqmjlgf6zq70_e` (Allow grouping of nodes recursively).
All decisions below were signed off item-by-item by the owner on 2026-08-14
(via `.out/current_decision.md`, two rounds).

## Goal

Groups within groups, arbitrary depth. Notes are aware of their ANCESTOR
folders and fall into grouping accordingly: a lone note in `SQL/sub/` renders
inside the `SQL` group; a subfolder with enough visible notes renders as a
nested box inside its ancestor's box.

## Current state (research summary)

- Grouping today is FLAT and always-on: `src/view/folderGrouping.ts`
  `deriveFolderGroups` buckets by IMMEDIATE parent folder only, threshold >=2
  direct members; a prior `groupByFolder` toggle was deliberately DELETED by
  owner decision (`docs-internal/notes/settings.md:153`).
- Rendering: React Flow subflows one level deep (`parentId` on members), elk
  layout (root: `force` + d3 refinement over top-level boxes; group interiors:
  `rectpacking`, edge-blind by measured decision at
  `src/view/constants.ts:157-202`).
- Feasibility: recursion is architecturally natural, NOT a rewrite. elk
  supports arbitrary nesting natively (`SEPARATE_CHILDREN` lays each level
  independently), React Flow handles multi-level `parentId` chains, and the
  position/dimension extraction walks (`extractElkPositions`,
  `extractElkDimensionsById`) are already recursive. Work concentrates in:
  grouping derivation, elk container construction + edge attachment, flow
  node emission + edge projection, truncation-badge attribution.
- Edge routing already treats EVERY note and group box as an obstacle
  (`src/view/edgeRouting.ts` `extractEdgeRoutingInput`) - intra-group edges
  route around siblings today; nesting only adds more `folder-group`
  obstacles. Cross links (`showCrossLinks` / `CrossLinkSweep`) already share
  the exact edge pipeline of walked edges.

## Signed-off decisions

- **D1 - Always-on, no toggle.** Recursive grouping replaces flat grouping
  wholesale. No on/off setting (KISS; consistent with the deleted
  `groupByFolder` precedent; avoids a second rendering mode doubling the
  layout/edge/e2e test matrix).
- **D2 - Grouping rules.**
  1. A folder qualifies as a group iff >=2 visible notes are its DESCENDANTS
     (not just direct children). Vault root never groups.
  2. Each note renders inside its NEAREST qualifying ancestor folder's group.
  3. Each qualifying group nests inside ITS nearest qualifying ancestor group.
  4. Redundant-chain collapse: a qualifying folder whose visible content is
     exactly one child group and nothing else is skipped (no outer box); the
     surviving group carries the collapsed chain (e.g. `A/B/C`).
- **A1 - Group label setting.** New settings group "Grouping" with ONE row:
  group label = `Folder name` (leaf, **DEFAULT**) vs `Full path` (collapsed
  chain). Pure text choice - group box size is computed from packed children +
  constant paddings with NO label measurement (CSS ellipsis), so this does not
  permute the layout/test matrix. Full folder path stays in the hover tooltip.
- **D3 - Edge collapsing via LCA.** For edge X->Y find the lowest common
  ancestor CONTAINER (a group, or the top-level canvas pane itself). Each
  endpoint projects to its outermost group strictly inside that container (or
  itself if ungrouped there). Same-container edges stay passthrough
  (member-to-member INSIDE a box is allowed); differing projections collapse
  onto the boundary boxes with a count badge - an edge never crosses a group
  boundary line. Applies identically to cross links (same pipeline).
- **D4 - Truncation badges.** A hidden (node-cap-cut) note's per-folder count
  attaches to the NEAREST RENDERED ANCESTOR group's `+N` badge (where the note
  would have rendered); the corner orphan overlay remains only for counts with
  no rendered ancestor box.
- **D5 - Interiors stay `rectpacking` in phase 1.** Nested boxes pack like big
  members. Edge-aware interior layout (per-container force/stress + d3
  refinement) is a FIRST-CLASS follow-up: plumbing seam + measured evaluation
  ending in owner visual sign-off (see follow-up tickets).

## Design invariants to preserve

- `deriveFolderGroups` stays PURE and deterministic - `elkMapping` and
  `flowMapping` call it independently and must not desync. LCA and
  nearest-rendered-ancestor lookups live ONCE, on the grouping-tree result
  (DRY) - consumers never re-derive them.
- React Flow node-array ordering generalizes to: ancestor groups before
  descendant groups before member notes.
- elk contract: each edge attaches to the closest common ancestor container in
  the elk input.
- Root force/d3 refinement is unchanged (top-level boxes only).
- Engine untouched for attribution: hidden counts stay keyed by immediate
  folder; ancestor attribution is a view concern.
- No stored-data impact (grouping is fully derived).
- `docs-internal/plan/high-level-plan.md` (documents flat grouping as a core
  differentiator) must be updated with these rules.

## Ticket breakdown (deps encoded in ticket frontmatter)

Implementation chain:
1. `nid_unqqausmhnujjixitr6kieflq_e` - grouping core: folder-group TREE
   derivation in `folderGrouping.ts` (rules D2, LCA + nearest-ancestor seams).
2. `nid_d44vbnq9o6rhuelfwclx2e34n_e` - layout: nested elk containers + LCA
   edge attachment (`elkMapping.ts`).
3. `nid_9uh2twn8whoqtplbxk0ywzpx7_e` - rendering: nested flow nodes,
   multi-level `parentId`, LCA edge collapse, collapsed-chain labels, routing
   input absolute coords (`flowMapping.ts`, `FolderGroupNode.tsx`,
   `edgeRouting.ts`).
4. `nid_3wnxsfexabjnx1uj9js2o1c43_e` - truncation badges: nearest rendered
   ancestor attribution (D4).
5. `nid_0nmhmv03071derz5ok30cisaa_e` - "Grouping" settings group: group-label
   row, default Folder name (A1).
6. `nid_5hnmpwtzakhd3le95jzigsvs0_e` - e2e scenarios + docs update (final
   gate, `npm run test:all`).

Follow-ups (D5, first-class interior layout):
7. `nid_as3hdgn25pbxttimy643f46v7_e` - per-container layout plumbing seam in
   `GraphLayoutRunner` (no default behavior change).
8. `nid_7abfje1vus15rx9hzmpel9jin_e` - edge-aware intra-group layout:
   measured evaluation (rectpacking vs force+d3 vs stress) + tuning, ends in
   owner visual sign-off (`decide` tag).

