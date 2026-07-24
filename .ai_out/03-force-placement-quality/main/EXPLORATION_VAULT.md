# EXPLORATION_VAULT — Enchiridion mid-graph placement bug (repro data)

## 1. Source note
`.out/vaults/public/_/basic-truth/we-have-a-finite-amount-of-time.md`
(frontmatter `id: 5o3o4vkmjpzmxjnbdjtu3g6`, `title: 'Basic Truth: We Have a Finite Amount of Time'`).

Wikilinks (document order):
```
[[_/philosophy/stoicism/key-th/memento-mori--remember-death]]
[[_/book/you-will-die]]
[[_/mental-models/regret-minimization-framework]]
[[Epictetus]]                                          -> p/Epictetus/Epictetus.md
[[p/Epictetus/book/The-Manual-Enchiridion/section/51]] -> "section/51" note (NOT the Enchiridion note)
```
Backlinks (depth-1 incoming):
- `_/philosophy/stoicism/key-th/memento-mori--remember-death.md` (bidirectional pair)
- `_/quotes/How can we create lives that are truly worth living-Given that these lives come to an end.md`
- `sc/do/FOCUS/laser-focus-on-what-you-control/Focusing on Variables outside control is Stealing Time from Actions.md`

## 2. Where "The Enchiridion (The Manual)" comes from
`.out/vaults/public/p/Epictetus/book/The-Manual-Enchiridion.md`
(`title: The Enchiridion (The Manual)`, id `rtan4nxrbrt068zdezqxprd`).

NOT a direct link of the active note — reached only 2 hops out via `Epictetus.md`:
```
p/Epictetus/Epictetus.md:
- [[rel/philosopher-of]]
- [[_/philosophy/stoicism]]
- [[rel/author-of]]
- ![[p/Epictetus/book/The-Manual-Enchiridion]]   (embed)
- ![[p/Epictetus/th]]
```
`The-Manual-Enchiridion.md` has exactly ONE inbound edge in the subgraph (from
`Epictetus.md`). Its only outbound link (`![[.../section]]`, a dataviewjs index)
falls outside outgoingDepth and is dynamic (not a resolved static link), so it
produces no graph edges. `section/51.md` has zero links and does NOT connect to
Enchiridion.

**=> In the vicinity graph, "The Enchiridion" has exactly ONE edge, to the
`Epictetus` hub. Classic hub + stranded 2nd-degree leaf pattern.** `Epictetus`
is a hub (5 outgoing + 2 incoming edges).

## 3. Engine traversal characterization
- `src/engine/VicinityTraversal.ts` — multi-root, per-direction BFS (independent
  outgoing/incoming passes, shallowest-depth-wins). Folder grouping is NOT part
  of traversal.
- `src/engine/constants.ts` — `DEFAULT_OUTGOING_DEPTH = 1`, `DEFAULT_INCOMING_DEPTH = 1`.
  Enchiridion (2 hops out) only surfaces at outgoingDepth ≥ 2. `VicinityEngine.test.ts`
  baseline uses `{ outgoingDepth: 2, incomingDepth: 1 }`.
- `src/engine/VicinityEngine.ts` — traverse → NodeSizer → GraphTruncator (node cap)
  → EdgeVisibility (default `"walked-from-center"`: only BFS-walked edges shown).
- `src/view/folderGrouping.ts` — VIEW layer: `deriveFolderGroups` groups nodes
  sharing a non-root folder when 2+ visible members (`MIN_GROUP_MEMBER_COUNT = 2`);
  singletons stay ungrouped. Enchiridion's folder (`p/Epictetus/book/`) has no
  folder-mates in the vicinity → renders as an **ungrouped root-level leaf**,
  exactly the population `d3ForceRefinement` repositions.

**Possible locus nuance:** `refineForceRootLayout` builds its `forceLink` links
from `root.edges` (ELK root-level edges). Cross-boundary edges are PROJECTED onto
container ids by `projectedRootEdges` (elkMapping.ts:86). If Epictetus is nested
inside a `p/Epictetus` folder-group container while Enchiridion is a root leaf,
the edge becomes (container → Enchiridion) at root — still a root edge, but the
container's collideRadius is large, inflating `forceLink.distance()`.

## 4. Minimal reproduction shape (outgoingDepth=2, incomingDepth=1)
Essential topology to reproduce "hub-with-stranded-node":
- `main.md` --> `hub.md` (Epictetus stand-in)
- `hub.md` --> 4-5 neighbors (real hub) AND --> `stranded.md` (Enchiridion stand-in)
- `stranded.md` has NO other edges to anything else in the graph (mirrors how
  section/51 and Enchiridion never connect despite conceptual relation)
- Optionally: hub in a folder that groups (2+ mates); stranded in a singleton
  folder → reproduces "hub inside container, leaf outside" root topology.

Full reconstructed adjacency (subgraph) is in the note/edge tables the explorer
produced; the minimal-reduction shape above is what a fixture needs.

## 5. `.dev-vault/` conventions
- Frontmatter optional/minimal; some notes have only `id:`, one shows `title:` override.
- **Wikilinks use bare basenames** (`[[note2]]`, `[[hub-medium]]`) — shortest-unique-path.
- Group fixtures `grp-a..grp-e`: each has 3 members, all link a shared hub
  (`hub-medium.md`) + one intra/inter-group link (satisfies MIN_GROUP_MEMBER_COUNT=2).
- Dense fixtures `zzdense-001..110` + `zzdense-hub`: 1 hub, ~110 spokes each with a chord.
- `solo/gamma.md`: singleton-folder (never groups) — analogous to Enchiridion's folder.

## 6. Test-fixture machinery
- **Engine-level**: `src/engine/FakeLinkProvider.ts` —
  `new FakeLinkProvider({ files: [{path, sizeBytes?}...], links: {"src.md":["t1.md"...]} })`,
  then `new VicinityEngine(provider).build({ main, globalDepths:{outgoingDepth:2,incomingDepth:1}, globalView, ... })`.
  Canonical pattern: `src/engine/VicinityEngine.test.ts:13-30`.
- **View/layout-level** (fastest for layout repro): `src/view/testFixtures/graphFixtures.ts`
  `makeNode`/`makeEdge`/`makeGraph`, feed `vicinityGraphToElk` → `GraphLayoutRunner().layout()`
  → `extractElkPositions`. Pattern: `src/view/D3ForceLayout.test.ts` `hubGraph()`.

## File pointers
- Repro data (not source-controlled → mirror into `.dev-vault/` or FakeVaultSpec):
  `.out/vaults/public/_/basic-truth/we-have-a-finite-amount-of-time.md`,
  `.out/vaults/public/p/Epictetus/Epictetus.md`,
  `.out/vaults/public/p/Epictetus/book/The-Manual-Enchiridion.md`,
  `.out/vaults/public/p/Epictetus/book/The-Manual-Enchiridion/section/51.md`.
- Engine: `VicinityTraversal.ts`, `VicinityEngine.ts`, `TraversalSettingsResolver.ts`, engine `constants.ts`.
- View/layout (likely locus): `d3ForceRefinement.ts`, `elkMapping.ts`, `folderGrouping.ts`, `GraphLayoutRunner.ts`.
- Fixtures: `FakeLinkProvider.ts`, `graphFixtures.ts`, `D3ForceLayout.test.ts`, `VicinityEngine.test.ts`.
