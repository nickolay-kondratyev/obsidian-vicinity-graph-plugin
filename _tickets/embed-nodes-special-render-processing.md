---
id: nid_14potmihi2tc0x421abf0awz6_e
title: Embed nodes special render processing
status: in_progress
deps: []
links: []
created_iso: '2026-08-07T01:30:04Z'
status_updated_iso: '2026-08-07T01:49:12Z'
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
