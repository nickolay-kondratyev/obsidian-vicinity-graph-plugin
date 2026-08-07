# Decision: Embed nodes nested rendering (ticket nid_14potmihi2tc0x421abf0awz6_e)

> **RESOLVED 2026-08-07.** All 9 answers are recorded in ticket
> `nid_e79vxubva52s9gq24idypb77x_e` (closed) — that ticket body is the durable
> record; this file is volatile. Q1–Q7 accepted; Q8 partial (V1 no-resize kept,
> resize workstream ticket `nid_1av3d7fx1072oyp5lxyhjd451_e`); Q9 overridden
> (no toggle — nesting always on). Vocab doc follow-up:
> `nid_1ht2a3rm0ng8wnlis259u5egg_e`.

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
**Recommendation: central == isMain (active note).** — [X] agree / [ ] other
Agree lets adjust the vocabulary in the planning as well, Lets add 'docs-internal/vocab.md' where are are going to capture the vocab that is used in code like 'isMain', 'isCentral' so going forward we are going to have crisp vocabulary in tickets.
We will also want to capture the new vocabulary we are adding and any other vocabulary that stands out from the code package to have common language. - I am thinking lets have separate follow up ticket to search for vocabulary to create this 'docs-internal/vocab.md' (it can include the vocab we discussed but offload the work of looking in code base for key vocab to a ticket).

### Q2. Tie-breaks when several same-rank containers embed the same node
Central wins, then pinned, then regular — but two pinned (or two regular)
embedders can both be rendered.
**Recommendation:** deterministic tie-break: smaller `minDepth` (closer to the
active note) wins, then lexicographic vault path. No per-graph memory.
— [X] agree / [ ] other

Agree closer to main node (active node) wins.

### Q3. Embed cycles among rendered nodes (a embeds b, b embeds a)
Nesting must be a forest.
**Recommendation:** assign containers in precedence order and refuse any
assignment that would create a cycle; the refused pair renders as a normal
embed edge (collapsed to outermost containers). Obsidian itself refuses
recursive embeds, so this is a degenerate case — deterministic, not clever.
— [X] agree / [ ] other
Yes just have an edge if we have circular case. Lets make sure we have a test for this.

### Q4. Interaction with folder groups
A nested node may belong to a folder that renders as a group.
**Recommendation:** nesting WINS — a nested node leaves its folder group (does
not count toward the group's 2-member minimum). A container (with its nested
subtree) may still sit inside a folder group, giving parent chains
group → container → nested (React Flow and elk both support depth). 
— [X] agree / [ ] other
Agree nesting wins over folder grouping.

### Q5. Edges between container and its own nested child
The embed edge n1→n2 is redundant once n2 renders inside n1.
**Recommendation:** never draw an edge between a node and its
ancestor/descendant in the nesting tree — even when the kind is `both`
(the plain link is still discoverable via the link-preview of nothing? 
No: it simply isn't drawn; accepted scope cut for v1). Edges between two nodes
nested under the SAME outermost container would collapse to a self-loop —
dropped, same as intra-folder-group self-loops today.
— [X] agree / [ ] other
Yes once we have nesting we do not draw edges between ancestor descending of nested tree, we also do not draw any edges between the relatives in the tree (for now). Note in the future we may we want to draw edges between direct siblings in the nesting tree but for V1 we do not. For V1 there are no edges drawn within the drawn nesting tree.

### Q6. Losing embedders still get an edge?
`n1 --embeds--> n2`
`n3 --embeds--> n2` but n2 nests inside n1 (n1 won precedence).
**Recommendation:** yes — draw n3 → n1 (collapsed to outermost container),
edge preview shows the true pair n3 →(embed) n2 via `notePairs`, exactly like
folder-group collapsed edges today. Likewise a pinned node embedded ONLY by
regular nodes is not nested at all: renders standalone with normal embed edges.
— [X] agree / [ ] other

### Q7. When is nesting computed — before or after truncation/node cap?
**Recommendation:** AFTER — nesting is pure presentation over the final
rendered node set (view layer, sibling of `folderGrouping.ts`). Traversal,
budgets, sizing, truncation are untouched. A truncated container simply means
its would-be child renders standalone.
— [X] agree / [ ] other
Agree we want to separate the algorithm of finding which nodes are in play from the nesting. In the future we will likely adjust for nested notes to have priority of getting under the cap, but again that is completely separate and will not be concern of the presentation.

### Q8. Container sizing & drag-resize (v1 scope)
**Recommendation (80/20):** container auto-grows to fit its children (elk
compound padding, like folder groups); children stack VERTICALLY in embed
order. v1 DISABLES drag-resize on containers and on nested children (size
overrides ignored while nested); follow-up ticket for resize semantics.
— [ ] agree / [X] other
OK I agree with the part of container auto-grows. BUT I do want to explore ability to resize the children.
And resize the container as well. Resizing the container will give more space primarily to the direct content of the container.
While the resizing the children if they are PUSHED past the containers edge would auto upsize the parent container/container chain.

I am envisioning that lets say we have the following all embedded
```
n1[[n2[n3 n4]]]
```
And n1 has an representative image it would render (imagine that its vertically down though): `n1[n1-image [n2[n3 n4]]]`, and scaling n1 larger gives more space to the n1-image while scaling n3 up can give more space to [n3]. IF n1 is being scaled down and pushing on internal nodes the internal nodes will scale down as well. 
-> THIS will likely be its own workstream to get done correctly.

### Q9. Global setting toggle?
**Recommendation:** one global toggle "Nest embedded notes" (default ON) in
`SETTINGS_SPEC` + declared row — cheap, honors POLS, easy rollback for users.
— [ ] agree / [X] other
We have no users. I am thinking we lower the testing surface area and ALWAYS have this embed behavior turned on. IF we have a feature request to turn this off we can add this later. For now always have embedded nesting turned on.

## How to reply
Edit this file inline (check boxes / write "other: ..."), or just tell me in
chat. The `decide`-tagged ticket for this is the resolution gate for the
implementation tickets.
