---
closed_iso: 2026-08-07T01:54:38Z
id: nid_14potmihi2tc0x421abf0awz6_e
title: Embed nodes special render processing
status: closed
deps: []
links: [nid_e79vxubva52s9gq24idypb77x_e]
created_iso: '2026-08-07T01:30:04Z'
status_updated_iso: 2026-08-07T01:54:38Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
TASK: **PLAN**. Lets clarify any gaps that exist for this ticket
  (if you need to explore code base use cheaper Explore-cheap sub-agent)
  ask human any questions that come up that require human decision.
  Finally create detailed plan with requirements of what we want to achieve
  and steps of execution and put it into a new ticket 
  (or multiple tickets if it warrants a split across multiple tickets).
  Close this ticket after planning is complete.
--------------------------------------------------------------------------------

We are going to change how the nodes are rendered in the graph when they are embedded (`![[embedded-note]]`).

We are going to draw the embedded nodes within the nodes that are embedded it. 

### Vocabulary
- Nested node: embedded node that is rendered within another node (container).
- Container: container node is the one that is nesting a node.
- Outermost container: the outermost container lets say we rendered: n1 --embed> n2 --embed> n3, n1 would be outermost container of n2, and n3.

Nested, container, and outermost container are rendering specific. Same note can have different container and outermost container depending on the graph. 

### Key scenarios

#### Relationship in the Nested nodes get drawn to the Outermost Container
Let say we have the following nested nodes drawn:
```
n1[n2[[n3] [n4]]
```
When we have relationship to [n2, n3, n4] they will all be drawn to `n1` When we click on relationship we in the link preview we will be able to see the details of where the relationships truly go. But from perspective of the graph we will be collapsing relationships to the outermost container.

#### Nested nodes render in the order they are embedded
Let's say we have embedding of notes such as, and n1 wins as outermost container for these nodes.
```
n1[n2[[n3] [n4]]
```
we will want to render this in the same order.

#### Central nodes take precedence on "Nesting" embeds over all other nodes
Example: If `n1 --embeds--> n2`  AND `n3 --embeds--> n2`
IF n1 is central (focused) then n2 is going to render within n1

#### Pinned nodes take precedence on "Nesting" embeds over regular nodes
Example: If `n1 --embeds--> n2`  AND `n3 --embeds--> n2`
and n3 is pinned node (and n1 is not central node) then n2 is going to render in n3

#### Central nodes do NOT get nested into any other nodes.
No other node is allowed to nest central node. 

#### Pinned nodes can only be nested into central node or other pinned node.
Pinned nodes can be nested into central node OR pinned node.
Pinned nodes cannot be nested into a regular node.

--------------------------------------------------------------------------------

## RESOLUTION (planning complete, 2026-08-07)

Planning done; this ticket is closed. Codebase exploration confirmed the feature
is well-supported: embed-vs-link is already first-class (`src/shared/LinkKind.ts`,
`EdgeKind` in `src/engine/types.ts`, kind-pure traversal channels), and compound
rendering + edge-collapse-with-`notePairs`-preserved already exists for folder
groups (`src/view/flowMapping.ts`, `src/view/elkMapping.ts`) — nesting reuses that
machinery, and the link-preview drawer already shows true note→note pairs for
collapsed edges, satisfying the "see where relationships truly go" requirement.

### Open decisions (human) — ticket `nid_e79vxubva52s9gq24idypb77x_e` (tag: decide)
9 questions (Q1–Q9) — answers RECORDED in ticket
`nid_e79vxubva52s9gq24idypb77x_e` body: central==isMain; container
tie-breaks (minDepth, then path); embed-cycle handling (forest, refuse cyclic
assignment); nesting wins over folder groups; no container↔descendant edges /
drop self-loops; losing embedders keep a collapsed edge; nesting computed
post-truncation in the view layer; v1 disables resize on containers/nested;
global toggle "Nest embedded notes" default ON.

### Plan tickets created (dependency chain)
1. `nid_e79vxubva52s9gq24idypb77x_e` — resolve decisions Q1–Q9 (**decide**).
2. `nid_r3qiyd7xx3bund6f73wf5h0vd_e` — P1: engine stamps per-source embed order
   on embed/both edges (pure, `EdgeAssembly`).
3. `nid_1moqnutin09drbiyxkd3l7r5k_e` — P2: pure view-layer nesting-assignment
   forest (`src/view/embedNesting.ts`): precedence, constraints, ties, cycles,
   child order.
4. `nid_qy5rc7sq261z23bp79bk8wsem_e` — P3: render nested subflows (React Flow
   `parentId` + elk compound), collapse edges to outermost container keeping
   `notePairs`, folder-group interplay, CSS; e2e suite green.
5. `nid_jbsbfqqxyy1brm26ul7873v5h_e` — P4: settings toggle per repo settings
   conventions + dedicated e2e specs + docs (`high-level-plan.md`,
   `architecture-map.md`, README).
