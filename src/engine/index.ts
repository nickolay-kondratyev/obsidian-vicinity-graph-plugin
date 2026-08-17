/**
 * PUBLIC API of the pure vicinity-graph engine.
 *
 * The engine is synchronous, side-effect free and NEVER imports `obsidian`,
 * `stable-ids-for-obsidian` or React (enforced by `importGuard.test.ts`). Obsidian
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
 * stable-ids-for-obsidian's `ensureDocId` BEFORE persisting the pin.
 * {@link PinnedNodeDescriptor} therefore requires `docid` (and
 * `pinTimestamp`). A doc whose `ensureDocId` returns null cannot be pinned. The
 * engine never interprets docids — it echoes them onto output nodes so
 * consumers never re-map identities.
 *
 * ## Settings are GLOBAL-only (owner decision 2026-07-29)
 * There is no per-doc settings layer: `globalDepths` carries one set of depth
 * budgets for MAIN and one for every pinned root (per ROLE, never per note),
 * `globalView` is used verbatim. Pins themselves stay global.
 */

export type {
	AttachmentRef,
	CentralNodeDescriptor,
	Channel,
	ChannelDepths,
	DepthSettings,
	DepthTag,
	DirectedLink,
	DocId,
	EdgeKind,
	FolderPath,
	ForceLayoutSettings,
	FrontmatterLinkSettings,
	GraphEdge,
	GraphNode,
	NodeContentOverride,
	NodeExclusionSettings,
	NodeOverride,
	NodePreviewPreference,
	NodeSizeOverridePx,
	OutlineEntry,
	RelationLabel,
	VicinityGraph,
	PinnedNodeDescriptor,
	SizingSettings,
	VaultPath,
	ViewSettings,
} from "./types";
export {
	asDocId,
	asFolderPath,
	asVaultPath,
	CHANNEL_DEPTH_FIELD,
	DepthSettingsFacts,
	NODE_CONTENT_OVERRIDES,
	NODE_PREVIEW_PREFERENCES,
} from "./types";
export { parseIdRefFields } from "./frontmatterLinkFields";
export { RelationshipStatements } from "./RelationshipStatements";
export type {
	RelationshipName,
	RelationshipStatement,
	RelationshipTarget,
	TextSpan,
} from "./RelationshipStatements";

export type { FileMetadata, LinkProvider, OutgoingReference } from "./LinkProvider";
export { OutgoingReferences } from "./LinkProvider";
// LinkKind lives in `shared/` (the layer BELOW the engine) because the shared
// syntax matchers must name it; the engine is still its public owner.
export type { LinkKind } from "../shared/LinkKind";
export type {
	LinkOccurrence,
	LinkOccurrenceProvider,
	OutgoingLinkOccurrence,
} from "./LinkOccurrenceProvider";
export type { LinkContextSnippet } from "./LinkContextSnippets";
export { EXPANDED_CONTEXT_LINES_EACH_SIDE, LinkContextSnippets } from "./LinkContextSnippets";
export { FakeLinkOccurrenceProvider } from "./FakeLinkOccurrenceProvider";
export type { FakeOccurrenceSpec } from "./FakeLinkOccurrenceProvider";
export { NodeEligibility } from "./NodeEligibility";
export { PathExclusionMatcher } from "./PathExclusionMatcher";
export { FakeLinkProvider } from "./FakeLinkProvider";
export type { FakeFileSpec, FakeNamedRelation, FakeVaultSpec } from "./FakeLinkProvider";

// Named relationships (feature `named-relationships`): the rel-note fold seam + its
// folding LinkProvider choke point, plus the fixture provider.
export type { RelationProvider } from "./RelationProvider";
export { RelationFoldingLinkProvider } from "./RelationFoldingLinkProvider";
export { FakeRelationProvider } from "./FakeRelationProvider";
export type { FakeRelationSpec } from "./FakeRelationProvider";

export { VicinityEngine } from "./VicinityEngine";
export type { GraphBuildRequest } from "./VicinityEngine";

// Pipeline stages, exported for targeted reuse/testing; most consumers only
// need the VicinityEngine facade above.
export { VicinityTraversal } from "./VicinityTraversal";
export type { TraversalResult, TraversalRoot, TraversedNode } from "./VicinityTraversal";
export { NodeSizer } from "./NodeSizer";
export type { NodeSizingView } from "./NodeSizer";
export { suppressedDuplicateThumbnails } from "./duplicateImageThumbnails";
export type { ThumbnailCandidate } from "./duplicateImageThumbnails";
export { nodePreviewKind } from "./nodePreviewKind";
export type { NodePreviewInput, NodePreviewKind } from "./nodePreviewKind";
export { GraphTruncator } from "./GraphTruncator";
export type { TruncationInput, TruncationResult } from "./GraphTruncator";
export { EdgeAssembly } from "./EdgeAssembly";
export type { EdgeAssemblyInput } from "./EdgeAssembly";
export { CrossLinkSweep } from "./CrossLinkSweep";
export type { CrossLinkSweepInput } from "./CrossLinkSweep";
export { NodePriorityChain } from "./NodePriorityChain";
export type { PriorityRankable } from "./NodePriorityChain";

export {
	ATTACHMENT_ROW_REVEAL_CONTENT_BOX_PX,
	ATTACHMENT_ROW_VISIBLE_MIN_NODE_PX,
	CENTRAL_NODE_VERTICAL_CHROME_PX,
	CENTRAL_PROMINENCE_FLOOR_SCORE,
	ESTIMATED_THUMBNAIL_SLOT_PX,
	EngineDefaults,
	FORCE_LAYOUT_RANGES,
	MAX_EDGE_DEPTH_INTO_GROUPS,
	MAX_FOLDER_GROUPING_DEPTH,
	MAX_OUTLINE_DEPTH,
	MAX_STEPPER_DEPTH,
	MIN_EDGE_DEPTH_INTO_GROUPS,
	MIN_FOLDER_GROUPING_DEPTH,
	MIN_OUTLINE_DEPTH,
	MIN_STEPPER_DEPTH,
	NODE_MAX_LABEL_WIDTH_PX,
	NODE_OVERRIDE_HARD_MAX_PX,
	NODE_OVERRIDE_HARD_MIN_PX,
	NODE_TITLE_CHAR_WIDTH_PX,
	NODE_VERTICAL_CHROME_PX,
	PREVIEW_SLOT_REVEAL_CONTENT_BOX_PX,
	PREVIEW_VISIBLE_MIN_NODE_PX,
	SIZING_RANGES,
	THUMBNAIL_PREVIEW_TITLE_LINE_CLAMP,
	clampEdgeDepthIntoGroups,
	clampFolderGroupingDepth,
	clampForceLayoutSettings,
	clampNodeCap,
	clampNodeSizeOverridePx,
	clampOutlineMaxDepth,
	clampSizingNumber,
	clampSizingSettings,
	estimateNodeLabelWidthPx,
	nodeVerticalChromePx,
	revealMinNodePx,
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
	FrontmatterLinkSpec,
	NodeExclusionSpec,
	SettingsSpec,
	SizingSpec,
	ViewSpec,
} from "./SettingsSpec";
