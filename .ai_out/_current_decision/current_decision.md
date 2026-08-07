# Decision: Embed nodes nested rendering (ticket nid_14potmihi2tc0x421abf0awz6_e)

## Background (30 seconds)

We will render embedded notes (`![[note]]`) INSIDE their embedding note's node
("nesting"), instead of as separate nodes with an edge. The codebase is already
well-positioned:

- Embed-ness is first-class: every outgoing reference carries `LinkKind`
  (`link` | `embed`), edges carry `EdgeKind` (`link` | `embed` | `both`)
  (`src/shared/LinkKind.ts`, `src/engine/EdgeAssembly.ts`).
- Compound rendering already exists: folder groups are React Flow subflows
  (`parentId`) + elk containers, and cross-boundary edges are already collapsed
  onto the container while keeping the real note→note pairs (`FlowEdge.notePairs`)
  for the link-preview drawer (`src/view/flowMapping.ts`, `src/view/elkMapping.ts`).
  Nesting reuses this machinery almost verbatim.

Ticket rules already decided (not re-asked): relationships to nested nodes
collapse to the OUTERMOST container; children render in embed order; container
precedence central > pinned > regular; central is never nested; pinned nests
only under central or pinned.

Plan tickets were created with the recommended defaults below; correct anything
you disagree with and the implementation tickets will be updated.

## Questions

### Q1. "Central" = the active (main) note only?
In code, `GraphNode.isCentral` is true for the MAIN note AND every pinned root;
`isMain` is true only for the active note. The ticket distinguishes central vs
pinned, so I read "central" = `isMain`.
**Recommendation: central == isMain (active note).** — [ ] agree / [ ] other

### Q2. Tie-breaks when several same-rank containers embed the same node
Central wins, then pinned, then regular — but two pinned (or two regular)
embedders can both be rendered.
**Recommendation:** deterministic tie-break: smaller `minDepth` (closer to the
active note) wins, then lexicographic vault path. No per-graph memory.
— [ ] agree / [ ] other

### Q3. Embed cycles among rendered nodes (a embeds b, b embeds a)
Nesting must be a forest.
**Recommendation:** assign containers in precedence order and refuse any
assignment that would create a cycle; the refused pair renders as a normal
embed edge (collapsed to outermost containers). Obsidian itself refuses
recursive embeds, so this is a degenerate case — deterministic, not clever.
— [ ] agree / [ ] other

### Q4. Interaction with folder groups
A nested node may belong to a folder that renders as a group.
**Recommendation:** nesting WINS — a nested node leaves its folder group (does
not count toward the group's 2-member minimum). A container (with its nested
subtree) may still sit inside a folder group, giving parent chains
group → container → nested (React Flow and elk both support depth). 
— [ ] agree / [ ] other

### Q5. Edges between container and its own nested child
The embed edge n1→n2 is redundant once n2 renders inside n1.
**Recommendation:** never draw an edge between a node and its
ancestor/descendant in the nesting tree — even when the kind is `both`
(the plain link is still discoverable via the link-preview of nothing? No:
it simply isn't drawn; accepted scope cut for v1). Edges between two nodes
nested under the SAME outermost container would collapse to a self-loop —
dropped, same as intra-folder-group self-loops today.
— [ ] agree / [ ] other

### Q6. Losing embedders still get an edge?
`n3 --embeds--> n2` but n2 nests inside n1 (n1 won precedence).
**Recommendation:** yes — draw n3 → n1 (collapsed to outermost container),
edge preview shows the true pair n3 →(embed) n2 via `notePairs`, exactly like
folder-group collapsed edges today. Likewise a pinned node embedded ONLY by
regular nodes is not nested at all: renders standalone with normal embed edges.
— [ ] agree / [ ] other

### Q7. When is nesting computed — before or after truncation/node cap?
**Recommendation:** AFTER — nesting is pure presentation over the final
rendered node set (view layer, sibling of `folderGrouping.ts`). Traversal,
budgets, sizing, truncation are untouched. A truncated container simply means
its would-be child renders standalone.
— [ ] agree / [ ] other

### Q8. Container sizing & drag-resize (v1 scope)
**Recommendation (80/20):** container auto-grows to fit its children (elk
compound padding, like folder groups); children stack VERTICALLY in embed
order. v1 DISABLES drag-resize on containers and on nested children (size
overrides ignored while nested); follow-up ticket for resize semantics.
— [ ] agree / [ ] other

### Q9. Global setting toggle?
**Recommendation:** one global toggle "Nest embedded notes" (default ON) in
`SETTINGS_SPEC` + declared row — cheap, honors POLS, easy rollback for users.
— [ ] agree / [ ] other

## How to reply
Edit this file inline (check boxes / write "other: ..."), or just tell me in
chat. The `decide`-tagged ticket for this is the resolution gate for the
implementation tickets.
