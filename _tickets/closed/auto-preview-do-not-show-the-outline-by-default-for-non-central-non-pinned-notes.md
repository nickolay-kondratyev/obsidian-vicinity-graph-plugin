---
closed_iso: 2026-08-05T18:22:12Z
id: nid_k2pa8khm6ugozmhkd6nlbdrq6_e
title: 'auto preview: do NOT show the outline by default for non-central non-pinned
  notes'
status: closed
deps: []
links: [nid_1mq3t7706vw2kj2kv7ljqlw6l_e, nid_jcxzhexfaksge2arjzca3w7ff_e, nid_9hx6okamx3yt0rg9iad2f4151_e]
created_iso: '2026-08-05T17:58:46Z'
status_updated_iso: 2026-08-05T18:22:12Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [ui, sizing]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
OWNER DECISION (2026-08-05), taken while closing the density-floor decide ticket nid_1mq3t7706vw2kj2kv7ljqlw6l_e (_tickets/closed/ux-decide-content-fit-nodes-are-floored-at-the-css-density-rungs-any-note-with-one-heading-is-122px.md).

WHERE WE WANT TO GO: 
- In the AUTO node preview mode, an ordinary note - NOT the central, NOT pinned - should not render outline by default
  - AUTO should render an image if it exist anywhere in the note (first image wins)
  - AUTO should render title if there is no image and no override for the node.
  - The outline (and by extension the preview slot) becomes a thing the central / pinned nodes get, not something every neighbour in the vicinity gets. UNLESS it is overwritten (we will allow overwrites per node later)

So the AUTO ladder becomes, for an ordinary neighbour: image (first image anywhere in the note) -> title only. Never the outline. For a central / pinned root the AUTO ladder is unchanged from today (outline vs image resolved by `imagePrecedesOutline`).

WHY: with content-fit sizing landed (nid_cx5zoz7ptucg9nxalibv0mbjb_e), any note with even ONE renderable heading is floored at the CSS reveal rung (122px, 124px for centrals) so the outline actually paints. At shipped defaults 40/160 that means nearly every content-bearing node sits in 122..160px: node size stops discriminating, and the graph reads as a wall of near-identical big boxes. Rather than lower the CSS density rungs (option 2/3 in the closed ticket) the owner wants to cut the demand for the preview slot instead - a peripheral note does not need its headings shown, the central does.

EXPECTED CONSEQUENCE: a peripheral note whose only content is headings shows NO preview region, so the reveal floor never engages for it and it lands at minPx (40px at defaults). A peripheral note WITH an image still takes the thumbnail, so it still floors at the 122px preview rung - the 104px thumbnail slot is fixed-height and genuinely needs it. Net: the wall of big boxes thins out to exactly the image-bearing notes plus the centrals, which is the intended signal ("there is a picture here" / "this is a root"), and the density-floor question from the closed ticket narrows to those.

SCOPE / TOUCH POINTS (verified against the tree at 2026-08-05):
- src/engine/nodePreviewKind.ts - THE chooser, and it is ENGINE-owned, not src/view/. That is load-bearing here: src/engine/NodeSizer.ts calls the same function, so the box and the rendered region cannot disagree by construction. Add the tier fact to NodePreviewInput (see below) and branch AUTO on it; keep it pure + unit-tested (src/engine/nodePreviewKind.test.ts).
- The tier fact already exists and already means what the owner drew the line at: TraversedNode.isCentral is documented "True for MAIN and every pinned root" (src/engine/types.ts). Pinning MAKES a note a root, so there is no third "pinned but not central" case to design for. Pass isCentral into nodePreviewKind; both call sites (NodeSizer.contentFitPx, src/view/flowMapping.ts ~line 394) already hold it.
- "First image wins, anywhere in the note" is ALREADY the semantics of TraversedNode.firstImagePath - src/engine/VicinityTraversal.ts takes the first `isImage` entry of metadata.attachments (document order, resolved refs only). No adapter or provider change. What changes is that `imagePrecedesOutline` stops being consulted on the peripheral branch; it stays live for centrals, so it is NOT dead code.
- No new preview kind is needed: NodePreviewKind already has "none", and src/view/NoteNode.tsx already renders nothing in the content slot for it (it gates on `data.preview === "outline" | "thumbnail"`).
- src/engine/NodeSizer.ts - once the chooser is tier-aware the sizer follows for free (it already sizes from the chooser's answer, and revealFloorPx only floors when preview !== "none"). Verify, do not duplicate the branch.
- Explicit per-node overrides and an explicit GLOBAL Outline preference must still win - this changes AUTO only.
- src/view/nodeDensityThresholds.test.ts pins engine constant == css rung + chrome; keep it green (this ticket must not move a rung).
- e2e/nodeOutline.e2e.ts asserts outline reveal bands on rendered nodes - most of those fixtures are NON-central notes that will stop showing an outline entirely. They are behaviour-capturing: re-align them explicitly (retarget to a central, or restate the band as a thumbnail band), never quietly delete.
- Dev-vault fixtures: whatever e2e note is used to prove "outline renders" must now be central or pinned; check e2e/ fixture writers before assuming a spec can just be re-pointed.

RELATED / SEQUENCING: the Title-only preference ticket nid_jcxzhexfaksge2arjzca3w7ff_e is now a LINK, not a blocker - AUTO resolving to the existing "none" kind needs nothing from that enum value. The two should still agree on copy if a settings knob comes out of question (b) below. Per-node override menu (the "UNLESS it is overwritten" half of the decision): nid_9hx6okamx3yt0rg9iad2f4151_e - until that ships there is NO way to get an outline back on a peripheral note except pinning it or flipping the global preference to Outline, which is a real (accepted) gap for the interim.

STILL TO DECIDE (flag to owner before implementing):
(a) RESOLVED by the tree, not a question: "central or pinned" is exactly TraversedNode.isCentral. Nothing to choose.
(b) Fixed behaviour, or a global setting with this as the default? Prefer fixed first (80/20); add a knob only if it is missed.
(c) NEW, from the image half of the decision: in a vault where most notes embed an image, every peripheral node takes the thumbnail and the graph is a wall of 122px boxes again - the exact complaint this ticket exists to fix, just re-sourced. Do we care yet? Cheapest answer if we do: peripheral AUTO gets a SMALLER thumbnail rung (the image can scale; the current 104px slot is sized for centrals). Do not build that pre-emptively - look at a real vault first.

## Acceptance Criteria

In auto mode: an ordinary (non-central, non-pinned) note with headings and NO image renders title only and sizes to minPx; the same note WITH an image renders the thumbnail; a central or pinned root still resolves outline-vs-image the way it does today. An explicit global Outline preference still forces the outline anywhere. NodeSizer never sizes for a region the chooser will not render (one shared call to nodePreviewKind, no duplicated branch). No CSS density rung moves. npm test and npm run test:e2e green, with the e2e/nodeOutline.e2e.ts bands explicitly re-aligned rather than deleted.

## RESOLUTION (2026-08-05) — implemented, closed

Decision (b) answered the 80/20 way: **fixed behaviour, no new knob.** The Auto
tier rule is not configurable; the existing Preview pill (`outline` / `image`)
is the escape hatch. (c) was NOT built — no smaller peripheral thumbnail rung;
look at a real vault first, as the ticket said.

### What changed

- `src/engine/nodePreviewKind.ts` — `NodePreviewInput` gained `isCentral`, and
  the chooser now computes `outlineOffered = outlineEntryCount > 0 && (preference
  !== "auto" || isCentral)` before the existing fallback branch. Auto on an
  ordinary neighbour therefore falls into the "no outline offered" arm:
  `hasImage ? "thumbnail" : "none"` — first image anywhere wins, else title only.
  `imagePrecedesOutline` is untouched and still live on the central branch.
- `src/engine/NodeSizer.ts` and `src/view/flowMapping.ts` — both pass
  `isCentral: node.isCentral` into the ONE shared `nodePreviewKind` call. No
  branch was duplicated; the sizer follows for free (its `revealFloorPx` only
  floors when `preview !== "none"`), so a headings-only neighbour now lands at
  `minPx`. Verified by test, not by inspection.
- No CSS rung moved; `src/view/nodeDensityThresholds.test.ts` is untouched and green.

### Tests

- `src/engine/nodePreviewKind.test.ts` — the truth table is now tier-aware:
  `previewForCentral` / `previewForNeighbour` helpers, a new
  "Auto preference for an ordinary neighbour" suite (5 cells) and a
  "neighbour under an EXPLICIT preference" suite proving the tier gate is Auto's
  alone.
- `src/engine/NodeSizer.test.ts` — behaviour-capturing cases that measured a
  NON-central node's outline HEIGHT were **re-aligned, not deleted**: they now
  state the Outline preference through a new `outlineShowingView()` helper whose
  doc comment records why. A new describe captures the tier rule as SIZE
  (headings-only neighbour → minPx; the same note pinned → larger; explicit
  Outline → sized for its outline anyway).
- `src/view/flowMapping.test.ts` — the Auto "position decides" case was retargeted
  to a CENTRAL and three cases added for the neighbour ladder.
- `e2e/nodeOutline.e2e.ts` — needed NO band re-alignment: every assertion in that
  file already targets the MAIN node. That is now LOAD-BEARING rather than
  incidental, so the file header says so explicitly.

### Copy / docs kept honest

- `src/view/nodePreviewPreferenceMeta.ts` (Auto option) and
  `src/view/settingsRows.ts` (Preview row description) both said things that are
  now false ("A note that only has one of the two always shows that one") — rewritten.
- `README.md` *Node contents* and `docs-internal/plan/high-level-plan.md` state
  the tier rule, its WHY, and the interim gap (pin it, or flip the pill, until
  per-node overrides `nid_9hx6okamx3yt0rg9iad2f4151_e` ship).

### Verification

`npm run check` clean. `npm test` 1647 passed / 119 files. `npm run test:e2e`
139 passed — green on two consecutive full runs on the final tree.

CALLED OUT: during this work the full e2e suite failed twice on an UNRELATED
case (`e2e/nodeResize.e2e.ts` "shrunk to the drag-resize floor"), then went green
on the two later full runs; a clean-tree full run was also green. Filed as
`nid_g1f5tjmxzr0hbfdeujvgwywsd_e` (order/state-dependent e2e flake) rather than
silently patched.
