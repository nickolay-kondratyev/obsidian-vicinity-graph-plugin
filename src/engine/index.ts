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
 * 2. Translate the persisted docid-keyed pinned set to path-keyed descriptors.
 * 3. `new VicinityEngine(provider).build(request)` per rebuild; render the
 *    returned {@link VicinityGraph} (nodes carry depth tags, attachments,
 *    first image and a diff-stable `sizePx`).
 *
 * ## Edge semantics (CLARIFICATION Q5)
 * Only the edges the BFS walked from a central render — a link between two
 * frontier nodes shows up only when the walk itself reached it. See
 * {@link EdgeAssembly}.
 *
 * ## Adapter contract for pins (step-03, MUST honor)
 * A note that receives a pin MUST have a docid: the adapter `await`s
 * obsidian-id-lib's `ensureDocId` BEFORE persisting the pin.
 * {@link PinnedNodeDescriptor} therefore requires `docid` (and
 * `pinTimestamp`). A doc whose `ensureDocId` returns null cannot be pinned. The
 * engine never interprets docids — it echoes them onto output nodes so
 * consumers never re-map identities.
 *
 * ## Settings are GLOBAL-only (owner decision 2026-07-29)
 * There is no per-doc settings layer: `globalDepths` drives MAIN and every
 * pinned root, `globalView` is used verbatim. Pins themselves stay global.
 */

export type {
	AttachmentRef,
	CentralNodeDescriptor,
	Channel,
	DepthSettings,
	DepthTag,
	DirectedLink,
	DocId,
	EdgeKind,
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
} from "./types";
export { asDocId, asFolderPath, asVaultPath, CHANNEL_DEPTH_FIELD, NODE_PREVIEW_PREFERENCES } from "./types";

export type { FileMetadata, LinkProvider, OutgoingReference } from "./LinkProvider";
export { OutgoingReferences } from "./LinkProvider";
// LinkKind lives in `shared/` (the layer BELOW the engine) because the shared
// syntax matchers must name it; the engine is still its public owner.
export type { LinkKind } from "../shared/LinkKind";
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
export { EdgeAssembly } from "./EdgeAssembly";
export type { EdgeAssemblyInput } from "./EdgeAssembly";
export { CrossLinkSweep } from "./CrossLinkSweep";
export type { CrossLinkSweepInput } from "./CrossLinkSweep";
export { NodePriorityChain } from "./NodePriorityChain";
export type { PriorityRankable } from "./NodePriorityChain";

export {
	CENTRAL_SIZE_SCORE,
	DEFAULT_DEPTH_DECAY_K,
	DEFAULT_LINK_DEPTH_IN,
	DEFAULT_MAX_NODE_PX,
	DEFAULT_MIN_NODE_PX,
	DEFAULT_NODE_CAP,
	DEFAULT_LINK_DEPTH_OUT,
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
	clampSizingNumber,
	clampSizingSettings,
} from "./constants";
export type { SettingsRange, SizingRangeField } from "./constants";

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
