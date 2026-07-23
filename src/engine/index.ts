/**
 * PUBLIC API of the pure vicinity-graph engine.
 *
 * The engine is synchronous, side-effect free and NEVER imports `obsidian`,
 * `obsidian-id-lib` or React (enforced by `importGuard.test.ts`). Obsidian
 * reaches it exclusively through the {@link LinkProvider} seam.
 *
 * ## Typical consumption (steps 03/04)
 * 1. Implement {@link LinkProvider} (step-03 `ObsidianLinkProvider` and the
 *    canvas-fallback provider both satisfy it unchanged — keep it that way).
 * 2. Translate persisted docid-keyed inputs (pins, depth overrides) to
 *    path-keyed descriptors/maps.
 * 3. `new VicinityEngine(provider).build(request)` per rebuild; render the
 *    returned {@link VicinityGraph} (nodes carry depth tags, attachments,
 *    first image and a diff-stable `sizePx`).
 *
 * ## Edge semantics ({@link EdgeVisibilityMode}, CLARIFICATION Q5)
 * `ViewSettings.edgeVisibility` picks which links become edges:
 * `"walked-from-center"` (default) renders only the edges the BFS walked;
 * `"all-edges"` renders every link between two visible nodes (induced
 * subgraph, swept post-truncation). A view-class setting — it cascades like
 * sizing/grouping/cap; the UI toggle lands in step-06.
 *
 * ## Adapter contract for pins / per-doc overrides (step-03, MUST honor)
 * A note that receives a pin or a per-doc override MUST have a docid: the
 * adapter `await`s obsidian-id-lib's `ensureDocId` BEFORE persisting the
 * override to disk. {@link PinnedNodeDescriptor} therefore requires `docid`
 * (and `pinTimestamp`). A doc whose `ensureDocId` returns null cannot be
 * pinned or carry per-doc settings. The engine never interprets docids — it
 * echoes them onto output nodes so consumers never re-map identities.
 */

export type {
	AttachmentRef,
	CentralNodeDescriptor,
	DepthOverride,
	DepthSettings,
	DepthTag,
	DirectedLink,
	Direction,
	DocId,
	EdgeVisibilityMode,
	FolderPath,
	GraphEdge,
	GraphNode,
	LayoutMode,
	NodeExclusionSettings,
	VicinityGraph,
	PinnedNodeDescriptor,
	SizeMetricId,
	SizingMetricSetting,
	SizingSettings,
	VaultPath,
	ViewSettings,
	ViewSettingsOverride,
} from "./types";
export { asDocId, asFolderPath, asVaultPath, DIRECTION_DEPTH_FIELD, LAYOUT_MODES } from "./types";

export type { FileMetadata, LinkProvider } from "./LinkProvider";
export { NodeEligibility } from "./NodeEligibility";
export { PathExclusionMatcher } from "./PathExclusionMatcher";
export { FakeLinkProvider } from "./FakeLinkProvider";
export type { FakeFileSpec, FakeVaultSpec } from "./FakeLinkProvider";

export { VicinityEngine } from "./VicinityEngine";
export type { GraphBuildRequest } from "./VicinityEngine";

// Pipeline stages, exported for targeted reuse/testing; most consumers only
// need the VicinityEngine facade above.
export { VicinityTraversal } from "./VicinityTraversal";
export type { TraversalResult, TraversalRoot, TraversedNode } from "./VicinityTraversal";
export { NodeSizer } from "./NodeSizer";
export type { NodeSize } from "./NodeSizer";
export { GraphTruncator } from "./GraphTruncator";
export type { TruncationInput, TruncationResult } from "./GraphTruncator";
export { EdgeVisibility } from "./EdgeVisibility";
export type { EdgeVisibilityInput } from "./EdgeVisibility";
export { NodePriorityChain } from "./NodePriorityChain";
export type { PriorityRankable } from "./NodePriorityChain";
export { TraversalSettingsResolver } from "./TraversalSettingsResolver";
export { ViewSettingsResolver } from "./ViewSettingsResolver";
export type { PinnedViewOverride, ViewSettingsResolutionInput } from "./ViewSettingsResolver";

export {
	CENTRAL_SIZE_SCORE,
	DEFAULT_DEPTH_DECAY_K,
	DEFAULT_EDGE_VISIBILITY,
	DEFAULT_INCOMING_DEPTH,
	DEFAULT_LAYOUT_MODE,
	DEFAULT_MAX_NODE_PX,
	DEFAULT_MIN_NODE_PX,
	DEFAULT_NODE_CAP,
	DEFAULT_OUTGOING_DEPTH,
	EngineDefaults,
	NEUTRAL_NORMALIZED_VALUE,
} from "./constants";
