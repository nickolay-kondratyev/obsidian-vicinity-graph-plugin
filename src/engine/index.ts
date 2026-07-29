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
 * ## Edge semantics (CLARIFICATION Q5)
 * Only the edges the BFS walked from a central render — a link between two
 * frontier nodes shows up only when the walk itself reached it. See
 * {@link EdgeCounts}.
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
	FolderPath,
	ForceLayoutSettings,
	GraphEdge,
	GraphNode,
	NodeExclusionSettings,
	NodePreviewPreference,
	OutlineEntry,
	VicinityGraph,
	PinnedNodeDescriptor,
	SizeMetricId,
	SizingMetricSetting,
	SizingSettings,
	VaultPath,
	ViewSettings,
	ViewSettingsOverride,
} from "./types";
export { asDocId, asFolderPath, asVaultPath, DIRECTION_DEPTH_FIELD, NODE_PREVIEW_PREFERENCES } from "./types";

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
export { EdgeCounts } from "./EdgeCounts";
export type { EdgeCountsInput } from "./EdgeCounts";
export { NodePriorityChain } from "./NodePriorityChain";
export type { PriorityRankable } from "./NodePriorityChain";
export { TraversalSettingsResolver } from "./TraversalSettingsResolver";
export { ViewSettingsResolver } from "./ViewSettingsResolver";
export type { PinnedViewOverride, ViewSettingsResolutionInput } from "./ViewSettingsResolver";

export {
	CENTRAL_SIZE_SCORE,
	DEFAULT_DEPTH_DECAY_K,
	DEFAULT_INCOMING_DEPTH,
	DEFAULT_MAX_NODE_PX,
	DEFAULT_MIN_NODE_PX,
	DEFAULT_NODE_CAP,
	DEFAULT_OUTGOING_DEPTH,
	EngineDefaults,
	FORCE_LAYOUT_RANGES,
	MAX_OUTLINE_DEPTH,
	MAX_STEPPER_DEPTH,
	MIN_NODE_CAP,
	MIN_OUTLINE_DEPTH,
	MIN_STEPPER_DEPTH,
	NEUTRAL_NORMALIZED_VALUE,
	NODE_VERTICAL_CHROME_PX,
	SIZING_RANGES,
	THUMBNAIL_VISIBLE_MIN_NODE_PX,
	clampForceLayoutSettings,
	clampOutlineMaxDepth,
	clampSizingSettings,
} from "./constants";
export type { SettingsRange } from "./constants";

// Settings defaults + limits, single source of truth (see SettingsSpec.ts).
// `SettingsDefaults` is a discoverability shim that points back at SETTINGS_SPEC.
export { SETTINGS_SPEC } from "./SettingsSpec";
export { SettingsDefaults } from "./SettingsDefaults";
export type {
	BoundedNumberSpec,
	DefaultSpec,
	DepthSpec,
	ForceLayoutSpec,
	MinBoundedNumberSpec,
	NodeExclusionSpec,
	SettingsSpec,
	SizingSpec,
	ViewSpec,
} from "./SettingsSpec";
