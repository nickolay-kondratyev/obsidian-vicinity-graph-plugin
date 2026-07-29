---
id: nid_puf4a4q6fgn5lpehh5dowfm1r_e
title: "\"Show cross links\" setting — render links between visible nodes the walk never traversed"
status: open
deps: [nid_wimjq4ewgbg21n4zx9d4qq3a0_e, nid_armoson86j0ii8c33r1odo1rc_e]
links: []
created_iso: 2026-07-29T18:05:04Z
status_updated_iso: 2026-07-29T18:05:04Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, graph, settings-cleanup]
---

**DECIDED — wanted (owner, 2026-07-29).** No longer a `decide` ticket. Blocked on the settings-cleanup
chain: implement only under the descriptor model + dual presenters, never on the old plumbing.

## Problem

An edge exists today only if the BFS actually traversed that link
(`src/engine/VicinityTraversal.ts:125` is the only `recordEdge` call), and a node is expanded only
while `currentDepth < depthLimit` (`src/engine/VicinityTraversal.ts:111`). Two visible nodes sitting
at the depth boundary can be linked in the vault and render with **no edge at all**. The truncator
only filters the walked set (`src/engine/GraphTruncator.ts:51`); it never adds.

This is distinct from the `xN` badge, which collapses parallel links between the SAME pair
(`src/engine/EdgeAccumulator.ts:13` dedupes, `src/engine/EdgeCounts.ts:28` attaches the count,
`src/view/badgeText.ts:37` renders `xN`). That already works and is not what this ticket changes.

Walked-only was a deliberate owner decision (step-02 CLARIFICATION Q5, "the cleaner graph"),
documented at `src/engine/EdgeCounts.ts:23` — this ticket makes it a **toggle** instead of a
hard-coded rule, and that doc comment must be updated accordingly.

## Spec

### Setting

- Label: **"Show cross links"**, boolean OFF/ON.
- **Default: OFF** — preserves today's behavior; users opt in to the denser view.
- **Full cascade**: global / MAIN / pinned override, exactly like every sibling field. Falls out of
  the descriptor model for free; no exception.
- Visible in **both** presenters — the settings tab and the in-graph controls panel — by
  construction, via the single descriptor (dep: nid_armoson86j0ii8c33r1odo1rc_e). The tab-vs-panel
  parity test must cover it with no bespoke wiring.
- Persisted like any other field; `version` bump only if the descriptor work requires one. Pre-release
  clean-break rules apply (no migrations).

### Behavior when ON

- Post-truncation, sweep the visible node set and emit every link whose source AND target are both
  visible — the induced subgraph. Outgoing-only iteration is sufficient (every real link is some
  source's outgoing link, and attachments can never be visible). Prior implementation is recoverable:
  `git show c694e36^:src/engine/EdgeVisibility.ts` (`collectInducedPairs()`).
- **Node selection is unaffected.** Truncation and distance-to-MAIN ranking keep running on the
  *walked* edge set; cross links only widen edges, never change which nodes are visible. This was a
  documented caveat of the deleted implementation and is now an explicit requirement — call it out in
  the code comment so nobody "fixes" it later.
- **Rendered identically to walked edges** (owner decision): same color, weight, direction handling,
  `xN` count badge, folder-group collapse. No `isCrossLink` flag, no dashed/dimmed variant. Do not
  introduce a styling seam for this.
- `xN` counts come from the same `provider.getLinkCount` path with the `Math.max(1, ...)` floor — no
  second multiplicity authority.

### Behavior when OFF

Byte-for-byte today's graph. Adding the setting must not perturb the default render.

## Testing

- Engine fixture test (`Fake*` provider): GIVEN two visible frontier nodes linked to each other and
  the walk never traversed that link, WHEN cross links ON THEN the edge renders; WHEN OFF THEN it
  does not.
- GIVEN cross links ON THEN the visible node set is identical to OFF (ranking untouched).
- GIVEN a cross-linked pair with N parallel links THEN the edge carries `count: N` (`xN` badge).
- Cascade test: MAIN/pinned override beats global; absent override inherits.
- Tab-vs-panel parity: descriptor test picks the row up automatically in both presenters.

## Acceptance Criteria

"Show cross links" ships as a full-cascade boolean setting, default OFF, present in both the settings
tab and the in-graph controls panel, implemented on the descriptor model, with the engine tests above
green and `src/engine/EdgeCounts.ts:23` updated to describe the toggle rather than a fixed rule.

## Background — human question and answer (2026-07-29)

> Aren't we rendering all links between nodes as collapsed together (and the amount of edges that
> were collapsed with XHowMany)? What is this ticket about?

Two different things: the `xN` badge collapses parallel links between the same pair; this ticket is
about node pairs with ZERO edge drawn because the BFS never traversed any link between them. See
**Problem** above.

The orphan `edgeVisibility` setting was deleted in nid_niz5dz6uqeyv237ckm15ittqa_e (it had no write
path anywhere), taking `src/engine/EdgeVisibility.ts` with it. `EdgeCounts.attach` today is literally
the surviving `walked-from-center` branch of that file.
