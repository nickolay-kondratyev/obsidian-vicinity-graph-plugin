/**
 * Domain vocabulary of the pure vicinity-graph engine.
 *
 * Identity boundary (binding decision, see step-02 CLARIFICATION Q1):
 * - The engine keys EVERYTHING on vault file path ({@link VaultPath}).
 * - Docids ({@link DocId}) are opaque strings echoed through untouched; the
 *   step-03 adapter translates the docid-keyed persisted pinned set to paths
 *   BEFORE it enters the engine.
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
 * One markdown heading offered for a node's outline. Engine-owned POJO (no
 * obsidian `HeadingCache` leakage — see the import guard).
 */
export interface OutlineEntry {
	/**
	 * The heading's text EXACTLY as Obsidian parsed it: the `#` marker and its
	 * surrounding whitespace are gone, but INLINE MARKDOWN IS INTACT —
	 * `[[links]]`, `**bold**`, `` `code` `` are all still present.
	 * This is the LINK KEY: the navigator sanitises it with Obsidian's own
	 * `stripHeadingForLink` to build `path#Heading`. Never render it directly —
	 * the view formats it for display.
	 */
	readonly rawText: string;
	/** Markdown heading level, 1–6. Drives the depth filter AND the rendered nesting. */
	readonly level: number;
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
 * `await ensureDocId(...)` (obsidian-id-lib) BEFORE persisting a pin — a doc
 * that cannot get a docid cannot be pinned.
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
	/** Heading outline offered as this node's in-node preview; empty when none applies. */
	readonly outline: readonly OutlineEntry[];
	/** First image among {@link attachments} in provider order (thumbnail candidate). */
	readonly firstImagePath?: VaultPath;
	/**
	 * Provider-reported document-position fact: a resolved image sits above this
	 * note's first heading. A FACT, not a decision — the view's preview rule turns
	 * it into "outline or thumbnail" (see `FileMetadata.imagePrecedesOutline`).
	 */
	readonly imagePrecedesOutline: boolean;
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
 * Final output edge. Only links the BFS walked from a central become edges
 * (step-02 CLARIFICATION Q5); see {@link import("./EdgeCounts").EdgeCounts}.
 */
export interface GraphEdge extends DirectedLink {
	/** Number of distinct links source→target (>= 1) — the UI's edge count badge. */
	readonly count: number;
}

/**
 * Which region a node's single preview slot shows when the note offers BOTH a
 * heading outline and an image (a note offering only one always shows that one):
 * - `"auto"` — the note decides by document position: the image wins iff it sits
 *   above the first heading (the documented "show the picture instead" hatch).
 * - `"outline"` — prefer the outline, overriding document position.
 * - `"image"` — prefer the first image, overriding document position.
 *
 * A view-layer knob like {@link ViewSettings.outlineMaxDepth}: the engine carries
 * it and reports the facts, the view's `nodePreviewChoice` applies it.
 */
export type NodePreviewPreference = "auto" | "outline" | "image";

/**
 * THE value list of {@link NodePreviewPreference}, in the order the segmented
 * control renders them left-to-right. Single-sourced: persistence validates
 * against it and the UI derives its option order from it.
 */
export const NODE_PREVIEW_PREFERENCES = [
	"auto",
	"outline",
	"image",
] as const satisfies readonly NodePreviewPreference[];

/**
 * Compile-time completeness: a preference missing from
 * {@link NODE_PREVIEW_PREFERENCES} surfaces here as a type error naming it,
 * rather than silently shipping an option nothing can select or persist.
 */
type UnlistedPreference = Exclude<NodePreviewPreference, (typeof NODE_PREVIEW_PREFERENCES)[number]>;
export const _assertEveryNodePreviewPreferenceListed: UnlistedPreference extends never ? true : UnlistedPreference =
	true;

// ---------------------------------------------------------------------------
// Settings shapes (persisted by step-03 in `data.json`). GLOBAL-only: there is
// no per-doc override layer — one value drives every root and every view.
// ---------------------------------------------------------------------------

/** The traversal depths every root walks with (MAIN and every pinned central). */
export interface DepthSettings {
	readonly outgoingDepth: number;
	readonly incomingDepth: number;
}

/**
 * Global node-exclusion settings (vault-wide). Each pattern
 * is a raw JS regex tested UNANCHORED and CASE-SENSITIVELY against the full
 * vault-relative path (including extension); an invalid pattern is silently
 * skipped. `enabled === false` or an empty list is a no-op. A settings shape (like
 * {@link DepthSettings}/{@link ViewSettings}) — persistence parses it, the engine
 * consumes it via {@link PathExclusionMatcher} at neighbor discovery.
 */
export interface NodeExclusionSettings {
	readonly enabled: boolean;
	readonly patterns: readonly string[];
}

/**
 * Single source of truth mapping a {@link Direction} to the depth field it controls
 * (`outgoing → outgoingDepth`, `incoming → incomingDepth`) on {@link DepthSettings}.
 * Shared by the engine and the step-06 controls so the mapping exists exactly once.
 * POLS — trivially invertible.
 */
export const DIRECTION_DEPTH_FIELD: Readonly<Record<Direction, keyof DepthSettings>> = {
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

/**
 * Force-layout tuning knobs (ticket-04). The first four mirror Obsidian's
 * NATIVE graph sliders (Center/Repel/Link force, Link distance — POLS); the
 * remaining px fields are the "Advanced spacing" section. Field names describe
 * the MECHANISM (what the value drives in the view's rendering pipeline), the UI
 * shows the native-parity labels. One atomic field on {@link ViewSettings} (like
 * `sizing`): it is stored, parsed and written WHOLESALE, never per knob.
 */
export interface ForceLayoutSettings {
	/** UI "Center force": d3 `forceX`/`forceY` pull of every box toward the layout centre. */
	readonly centerPullStrength: number;
	/**
	 * UI "Repel force": magnitude of the d3 `forceManyBody` repulsion between
	 * root-level boxes. Stored POSITIVE (intuitive slider/JSON value); the view
	 * negates it into d3's negative-charge convention at the call site.
	 */
	readonly repelStrength: number;
	/**
	 * UI "Link force": multiplier on d3's default per-link spring strength
	 * (`1 / min(degree(source), degree(target))`). `1` reproduces d3's built-in
	 * default exactly — the shipped behavior before this knob existed.
	 */
	readonly linkStrengthFactor: number;
	/** UI "Link distance": extra px on a link's resting length beyond the endpoints' half-extents. */
	readonly linkGapPx: number;
	/** UI "Node spacing" (advanced): min gap px the rect-collide force enforces per box pair. */
	readonly collidePaddingPx: number;
	/** UI "Group member spacing" (advanced): elk `spacing.nodeNode` px INSIDE a folder group. */
	readonly elkNodeSpacingPx: number;
	/**
	 * UI "Edge clearance" (advanced): px clearance the obstacle-avoiding edge
	 * router keeps around every box (libavoid `shapeBufferDistance`).
	 *
	 * WHY it lives here and not on {@link ViewSettings} (edge-routing__06, human
	 * decision D1): it is a px spacing knob of the same class as the two above,
	 * and `forceLayout` already carries the whole cascade, both slider surfaces,
	 * the clamped parse and the relayout-on-change diff. Accepted cost: changing
	 * it triggers a full elk+d3 relayout it does not actually need. The name says
	 * ROUTING (not just "spacing") so the mechanism is unmistakable here.
	 */
	readonly edgeRoutingClearancePx: number;
}

/** The view settings a build renders with. */
export interface ViewSettings {
	/** Hard cap on NON-central node count (centrals are exempt). */
	readonly nodeCap: number;
	/**
	 * Deepest markdown heading level a node's outline renders (1–6). A view-layer
	 * knob: the engine carries it, the view's mapping applies it.
	 */
	readonly outlineMaxDepth: number;
	/** Which region claims a node's preview slot when the note offers both. */
	readonly nodePreviewPreference: NodePreviewPreference;
	readonly sizing: SizingSettings;
	readonly forceLayout: ForceLayoutSettings;
}

/** Final engine output consumed by steps 03/04. */
export interface VicinityGraph {
	readonly nodes: readonly GraphNode[];
	readonly edges: readonly GraphEdge[];
	/** Nodes hidden by truncation, counted per folder (UI badge on folder groups). */
	readonly hiddenNodeCountsByFolder: ReadonlyMap<FolderPath, number>;
	/**
	 * Distinct vault paths rejected by global node exclusion during traversal
	 * (0 when exclusion is disabled/empty). Surfaced next to the toolbar pill.
	 */
	readonly excludedNodeCount: number;
	/** The view settings the build actually used (post cascade resolution). */
	readonly viewSettings: ViewSettings;
}
