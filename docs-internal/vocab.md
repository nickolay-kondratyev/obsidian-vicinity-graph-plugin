# vocab.md — Vicinity Graph shared vocabulary

Crisp definitions of the load-bearing terms **used in the code**, so tickets and
design docs use the exact term the code uses. One glossary, 1–3 lines per entry
with the owning file. This is NOT an architecture doc — for structure and
layering see [`architecture-map.md`](./architecture-map.md); this only names things.

## Centrality & roots

- **MAIN node** — the active/focused note; `GraphNode.isMain` (`src/engine/types.ts`). The one active-file root. Tickets sometimes say "central (focused)" — the crisp term is **MAIN**.
- **Central** — `GraphNode.isCentral` == the MAIN node **or** any pinned root; i.e. a traversal root. NOT a synonym for MAIN. Centrals are node-cap exempt and prominence-floored (`src/engine/types.ts`).
- **Pinned** — a central that is not MAIN (`isCentral && !isMain`); persisted as a docid-keyed pinned set (`src/persistence/`, `src/engine/types.ts`).
- **TraversalRoot / traversal roots** — a BFS start point paired with its resolved per-root `ChannelDepths`; the roots are MAIN plus every pinned central (`src/engine/VicinityTraversal.ts`).
- **vicinity** — the multi-root BFS neighborhood the engine builds around the roots (`src/engine/VicinityTraversal.ts`, `src/engine/VicinityEngine.ts`).

## Embed-nesting vocabulary (rendering-specific)

Rendering-specific: the same note can have different containers in different graphs.

- **Nested node** — a node rendered *inside* a container rather than as a free peer.
- **Container** — a node that nests another node inside it.
- **Outermost container** — the root of a nesting tree (the container not itself nested).

## Channels & depth

- **Channel** — one traversal relationship the BFS follows out of a root, each with its own depth budget; flat enum `"outgoing-link" | "outgoing-embed" | "incoming"`, deliberately not a direction×kind matrix (`src/engine/types.ts`).
- **kind-pure channels** — the two *outgoing* channels are split by LinkKind (link vs embed) so each spends its own budget; the *incoming* channel is deliberately kind-blind (no "embedded-in" budget) (`src/engine/types.ts`, `CHANNEL_DEPTH_FIELD`).
- **DepthTag / depthTags** — a node's depth as seen from ONE root in ONE channel; every node keeps the full per-root×per-channel map (`src/engine/types.ts`).
- **minDepth** — minimum depth across all roots and channels; 0 for centrals (`src/engine/types.ts`).
- **ChannelDepths / DepthSettings** — the per-channel hop budgets a root walks with; `DepthSettings` carries active-note budgets plus parallel `pinned*` budgets, projected per role by `DepthSettingsFacts` (`src/engine/types.ts`).

## Kinds: link vs edge

- **LinkKind** — vault-generic distinction of HOW one reference points: `"link" | "embed"` (`src/shared/LinkKind.ts`).
- **EdgeKind** — the SUMMARY of a rendered pair's outgoing reference kinds: `"link" | "embed" | "both"`; derived from provider truth in `src/engine/EdgeAssembly.ts` (`src/engine/types.ts`).

## Reference vs link vs occurrence

- **OutgoingReference / reference** — one resolved outgoing pointer carrying WHERE (target) and HOW (LinkKind); kind is per-reference, so A→B can appear twice (`src/engine/LinkProvider.ts`).
- **link** — the kind-blind view of references (distinct targets; "what does this point at" ignoring how) (`src/engine/LinkProvider.ts`, `OutgoingReferences.targetsOf`).
- **LinkOccurrence / occurrence** — one concrete appearance of a link in a source note's text (offset + context snippet); the unit the edge-click drawer lists, one level finer than deduped path-links (`src/engine/LinkOccurrenceProvider.ts`).

## Provider seams

- **LinkProvider** — THE sole synchronous seam between the pure engine and Obsidian: outgoing references/links, incoming links, per-file metadata, per-pair counts (`src/engine/LinkProvider.ts`; impl `src/adapters/ObsidianLinkProvider.ts`).
- **LinkOccurrenceProvider** — async occurrence-level companion for the edge-click drawer, returning snippets between a source/target pair (`src/engine/LinkOccurrenceProvider.ts`; impl `src/adapters/ObsidianLinkOccurrenceProvider.ts`).

## Identity & keys

- **DocId / docid** — opaque persistence identity minted by `obsidian-id-lib`, echoed through the engine untouched; persistence (pins, overrides) is docid-keyed while the engine is path-keyed (`src/engine/types.ts`).
- **VaultPath** — vault-relative file path; the engine's universal traversal key, covering notes AND attachments (`src/engine/types.ts`).
- **FolderPath** — vault-relative folder path; `""` is the vault root (`src/engine/types.ts`).
- **PathDocIdMap** — in-memory bidirectional path↔docid map bridging docid-keyed persistence with path-speaking vault events, making renames a persistence non-event (`src/persistence/PathDocIdMap.ts`).

## Attachments & node-bearing

- **node-bearing / isNodeBearing** — adapter rule that a file can be a graph node (`.md` + `.canvas`); non-node-bearing files never become nodes (`src/engine/LinkProvider.ts`, `FileMetadata.isNodeBearing`).
- **AttachmentRef / attachment** — a non-node-bearing file (image, pdf, …) referenced by a node; surfaces as an attachment, never a node, and never consumes a depth budget (`src/engine/types.ts`).

## Truncation & cap

- **node cap / nodeCap** — hard cap on NON-central node count (centrals exempt); a `ViewSettings` dial (`src/engine/types.ts`, applied in `src/engine/GraphTruncator.ts`).
- **truncation** — applying the node cap: rank non-central candidates deterministically and keep the top `nodeCap`, recording hidden-per-folder counts (`src/engine/GraphTruncator.ts`; ranking in `src/engine/NodePriorityChain.ts`).
- **hiddenNodeCountsByFolder** — nodes dropped by truncation, counted per folder; feeds the folder-group badge (`src/engine/types.ts`, `src/engine/GraphTruncator.ts`).
- **NodePriorityChain** — the deterministic, tie-broken ranking (distance-to-MAIN, …) deciding which non-central nodes survive truncation (`src/engine/NodePriorityChain.ts`).

## Overrides

- **NodeOverride / nodeOverrides** — a user's per-node override (pixel size box and/or content preference); a GLOBAL fact about one doc keyed by docid like a pin (NOT a per-document settings layer), moving PIXELS only and not affecting truncation ranking (`src/engine/types.ts`).
- **NodeContentOverride** — the per-node preview-region choice: the preview preferences minus `"auto"` ("Inherit" is expressed by field absence) (`src/engine/types.ts`).

## View mapping (React Flow)

- **FlowNode** — the React-Flow-shaped node payload from the pure mapping; a union of `NoteFlowNode` and `GroupFlowNode` (`src/view/flowMapping.ts`).
- **FlowEdge** — the rendered edge payload: id, endpoints, count, EdgeKind, `notePairs` (`src/view/flowMapping.ts`).
- **notePairs / EdgeNotePair** — the engine note→note pairs a rendered edge stands for (one for a passthrough edge, many for a group-collapsed edge whose endpoints are folder-group ids); the drawer queries occurrences per pair (`src/view/flowMapping.ts`).
- **folder group / FolderGroup** — a folder rendered as a container node when 2+ visible nodes live in it (vault root never groups; singletons stay ungrouped) (`src/view/folderGrouping.ts`).
- **NodeTier** — view styling discriminant `"main" | "pinned-central" | "regular"`, so renderers never re-derive tier from flag pairs (`src/view/flowMapping.ts`).

## Layout diff

- **structural diff / relayout vs reuse-layout** — `decideLayout` compares a rebuilt graph to the previous one: `"reuse-layout"` (identical node+edge id sets, no over-growth: refresh data, keep positions) or `"relayout"` (first build, structural change, force-layout tuning change, or an override/box that no longer fits) (`src/view/GraphStructureDiff.ts`, `LayoutDecision`).

## Other engine terms

- **CrossLinkSweep** — the induced subgraph over visible nodes that `showCrossLinks` turns on: every link between two on-screen nodes, seeded from the walked set so the toggle only widens edges, never node selection (`src/engine/CrossLinkSweep.ts`).
- **NodePreviewPreference / nodePreviewKind** — which single region claims a node's preview slot (`"auto" | "title-only" | "outline" | "image"`); the tier-aware precedence rule is engine-owned so sizer and view agree (`src/engine/types.ts`, `src/engine/nodePreviewKind.ts`).
- **excludedNodeCount / NodeExclusionSettings** — vault-wide regex path exclusion applied at neighbor discovery, with a surfaced count of distinct rejected paths (`src/engine/types.ts`, matcher `src/engine/PathExclusionMatcher.ts`).
- **VicinityGraph** — the final engine output (nodes, edges, hidden-per-folder counts, excluded count, resolved viewSettings) consumed by the view (`src/engine/types.ts`).
- **VicinityEngine / GraphBuildRequest** — the engine facade: `new VicinityEngine(provider).build(request)` runs traversal → sizing → truncation → edge assembly per rebuild (`src/engine/VicinityEngine.ts`).
