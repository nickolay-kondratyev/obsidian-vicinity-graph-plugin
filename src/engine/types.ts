/**
 * Domain vocabulary of the pure vicinity-graph engine.
 *
 * Identity boundary (binding decision, see step-02 CLARIFICATION Q1):
 * - The engine keys EVERYTHING on vault file path ({@link VaultPath}).
 * - Docids ({@link DocId}) are opaque strings echoed through untouched; the
 *   step-03 adapter translates docid-keyed persisted inputs (pins, per-root
 *   depth overrides) to paths BEFORE they enter the engine.
 */

/** Vault-relative file path — the engine's traversal key. Covers notes AND attachments. */
export type VaultPath = string & { readonly __brand: "VaultPath" };

/**
 * Opaque persistence identity supplied by the adapter (obsidian-id-lib).
 * NO format assumptions (foreign/legacy formats are honored as-is upstream).
 */
export type DocId = string & { readonly __brand: "DocId" };

/** Vault-relative folder path; "" is the vault root. */
export type FolderPath = string & { readonly __brand: "FolderPath" };

export function asVaultPath(path: string): VaultPath {
	return path as VaultPath;
}

export function asDocId(docid: string): DocId {
	return docid as DocId;
}

export function asFolderPath(folder: string): FolderPath {
	return folder as FolderPath;
}

/** Traversal direction relative to a root: links it points at vs. links pointing at it. */
export type Direction = "outgoing" | "incoming";

/** Depth of a node as seen from ONE root in ONE direction (full map kept per node). */
export interface DepthTag {
	readonly rootPath: VaultPath;
	readonly direction: Direction;
	readonly depth: number;
}

/** A non-node-bearing file referenced by a node (image, pdf, ...). Never a graph node itself. */
export interface AttachmentRef {
	readonly path: VaultPath;
	readonly isImage: boolean;
}

/**
 * A root the traversal starts from. `docid`/`pinTimestamp` are echoed to output
 * nodes so steps 03/04 never re-map identities.
 */
export interface CentralNodeDescriptor {
	readonly path: VaultPath;
	readonly docid?: DocId;
	/** Epoch ms of when the node was pinned. Present only for pinned centrals. */
	readonly pinTimestamp?: number;
}

/**
 * A pinned central. Carries a docid by contract: the step-03 adapter MUST
 * `await ensureDocId(...)` (obsidian-id-lib) BEFORE persisting a pin or a
 * per-doc override — a doc that cannot get a docid cannot be pinned.
 */
export interface PinnedNodeDescriptor extends CentralNodeDescriptor {
	readonly docid: DocId;
	readonly pinTimestamp: number;
}

/** Fully-computed output node (post traversal + sizing). */
export interface GraphNode {
	readonly path: VaultPath;
	/** Echoed from the central/pinned descriptor; absent on ordinary neighbors. */
	readonly docid?: DocId;
	/** File basename without extension (display name). */
	readonly title: string;
	readonly folder: FolderPath;
	readonly sizeBytes: number;
	/** True for MAIN and every pinned root. */
	readonly isCentral: boolean;
	/** True only for the MAIN (active-file) root. */
	readonly isMain: boolean;
	/** Full per-root × per-direction depth map (UI steppers need per-root values). */
	readonly depthTags: readonly DepthTag[];
	/** Minimum depth across all roots and directions; 0 for centrals. */
	readonly minDepth: number;
	readonly attachments: readonly AttachmentRef[];
	/** First image among {@link attachments} in provider order (thumbnail candidate). */
	readonly firstImagePath?: VaultPath;
	/** Composed, normalized sizing score in [0, 1]. Centrals are pinned to 1. */
	readonly sizeScore: number;
	/** Pixel size mapped from {@link sizeScore}; the stable field step-04 diffs against. */
	readonly sizePx: number;
}

/**
 * Directed ordered pair: `source` links to `target`. Deduplicated per
 * (source, target). The COUNT-free shape used by intermediate pipeline stages
 * (traversal, truncation) — only the final output edge carries multiplicity,
 * because the true per-pair link count is provider knowledge (see
 * {@link LinkProvider.getLinkCount}), not something the BFS can tally
 * (multi-root walks revisit the same pair).
 */
export interface DirectedLink {
	readonly source: VaultPath;
	readonly target: VaultPath;
}

/**
 * Final output edge. Which links become edges is governed by
 * {@link EdgeVisibilityMode}.
 */
export interface GraphEdge extends DirectedLink {
	/** Number of distinct links source→target (>= 1) — the UI's edge count badge. */
	readonly count: number;
}

/**
 * Which links between visible nodes become edges (binding decision, see
 * step-02 CLARIFICATION Q5; naming follows the human's wording):
 * - `"walked-from-center"` — only edges the BFS walked while expanding from
 *   the centrals; links between two frontier nodes are NOT shown.
 * - `"all-edges"` — induced subgraph: after truncation, EVERY link between two
 *   visible nodes gets an edge (e.g. two depth-1 siblings linking each other,
 *   or a link between nodes discovered by different roots).
 */
export type EdgeVisibilityMode = "walked-from-center" | "all-edges";

// ---------------------------------------------------------------------------
// Settings shapes (persisted by step-03; resolved by the engine's resolvers).
// Per-field semantics everywhere: absence = inherit, presence = pinned.
// ---------------------------------------------------------------------------

/** Fully-resolved traversal depths for one root. */
export interface DepthSettings {
	readonly outgoingDepth: number;
	readonly incomingDepth: number;
}

/** Partial per-doc depth override (absence = inherit the global default). */
export interface DepthOverride {
	readonly outgoingDepth?: number;
	readonly incomingDepth?: number;
}

/**
 * Single source of truth mapping a {@link Direction} to the depth field it controls
 * (`outgoing → outgoingDepth`, `incoming → incomingDepth`) on {@link DepthSettings} /
 * {@link DepthOverride}. Shared by the engine resolvers and the step-06 controls so
 * the mapping exists exactly once. POLS — trivially invertible.
 */
export const DIRECTION_DEPTH_FIELD: Readonly<Record<Direction, keyof DepthOverride>> = {
	outgoing: "outgoingDepth",
	incoming: "incomingDepth",
};

/** Toggle + weight of one sizing metric. */
export interface SizingMetricSetting {
	readonly enabled: boolean;
	readonly weight: number;
}

export type SizeMetricId =
	| "own-file-size"
	| "total-linker-size"
	| "backlink-count"
	| "outlink-count"
	| "depth-decay";

/** Composable sizing configuration: each metric independently toggled/weighted. */
export interface SizingSettings {
	readonly metrics: Readonly<Record<SizeMetricId, SizingMetricSetting>>;
	/** `k` in the depth-decay formula `1 / (1 + k * depth)`. */
	readonly depthDecayK: number;
	readonly minPx: number;
	readonly maxPx: number;
}

/** Fully-resolved view settings. */
export interface ViewSettings {
	/** Hard cap on NON-central node count (centrals are exempt). */
	readonly nodeCap: number;
	readonly groupByFolder: boolean;
	readonly edgeVisibility: EdgeVisibilityMode;
	readonly sizing: SizingSettings;
}

/**
 * Partial view override (MAIN's or a pinned doc's). One resolvable field per
 * property; `sizing` is a single field in V1 (per-metric pinning would be
 * over-engineering until per-view overrides land).
 */
export type ViewSettingsOverride = Partial<ViewSettings>;

/** Final engine output consumed by steps 03/04. */
export interface VicinityGraph {
	readonly nodes: readonly GraphNode[];
	readonly edges: readonly GraphEdge[];
	/** Nodes hidden by truncation, counted per folder (UI badge on folder groups). */
	readonly hiddenNodeCountsByFolder: ReadonlyMap<FolderPath, number>;
	/** The view settings the build actually used (post cascade resolution). */
	readonly viewSettings: ViewSettings;
}
