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

/**
 * ONE traversal channel out of a root: a relationship the BFS follows, with its
 * OWN depth budget ({@link CHANNEL_DEPTH_FIELD}).
 *
 * A FLAT enum, not a `direction × kind` matrix, deliberately (ticket
 * `nid_fay1hu5sxcoygizopkkg0f0d7_e`, decision D1): the incoming side is
 * kind-blind by scope, so a matrix would spend a whole axis on a cell that does
 * not exist. Adding one (e.g. `incoming-embed`) later is purely additive — every
 * `Record<Channel, …>` in the repo turns into the compile error that names the
 * places it has to be taught (OCP).
 */
export type Channel = "outgoing-link" | "outgoing-embed" | "incoming";

/**
 * THE value list of {@link Channel}, in traversal order. Single-sourced so the
 * traversal cannot walk fewer channels than the type declares — the guard below
 * is what makes that real.
 */
export const CHANNELS = ["outgoing-link", "outgoing-embed", "incoming"] as const satisfies readonly Channel[];

/**
 * Compile-time completeness: a channel missing from {@link CHANNELS} surfaces
 * here as a type error naming it, rather than silently shipping a depth budget
 * no BFS run ever honours.
 */
type UnlistedChannel = Exclude<Channel, (typeof CHANNELS)[number]>;
export const _assertEveryChannelListed: UnlistedChannel extends never ? true : UnlistedChannel = true;

/** Depth of a node as seen from ONE root in ONE channel (full map kept per node). */
export interface DepthTag {
	readonly rootPath: VaultPath;
	readonly channel: Channel;
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
	/** Full per-root × per-channel depth map (UI steppers need per-root values). */
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
	/**
	 * Content-fit node height (px): the estimate of what this node SHOWS (title
	 * lines, renderable outline entries or thumbnail), clamped into the
	 * `sizing.minPx..maxPx` dials, with centrals floored at a modest prominence
	 * point of that range (never forced to maxPx — node-sizing rethink Q2). The
	 * stable field step-04 diffs against. Computed by
	 * {@link import("./NodeSizer").NodeSizer}.
	 */
	readonly sizePx: number;
	/**
	 * The user's per-node override, echoed from the request (docid → path
	 * translated by the adapter) so the view applies it without re-mapping
	 * identities. Q4 (decided): overrides move PIXELS only — truncation ranking
	 * (`NodePriorityChain`) is unaffected by a manual resize.
	 */
	readonly override?: NodeOverride;
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
 * HOW a rendered pair is related — the SUMMARY of the pair's outgoing reference
 * kinds ({@link import("../shared/LinkKind").LinkKind}), not a scalar copy of one
 * walked hop: a source can both embed AND plainly link the same target, and that
 * pair is deliberately `"both"` rather than whichever kind a walk saw first.
 * Derived once, from provider truth, in {@link import("./EdgeAssembly").EdgeAssembly}.
 */
export type EdgeKind = "link" | "embed" | "both";

/**
 * Final output edge. WHICH links become edges is the {@link ViewSettings.showCrossLinks}
 * toggle's answer: the links the BFS walked, or every link between two visible nodes.
 * Both origins are identical here — there is deliberately no walked-vs-swept
 * provenance flag ({@link kind} is the pair's relationship, not its discovery path).
 */
export interface GraphEdge extends DirectedLink {
	/** Number of distinct links source→target (>= 1) — the UI's edge count badge. */
	readonly count: number;
	/** The pair's relationship summary — drives the view's edge styling. */
	readonly kind: EdgeKind;
}

/**
 * Which region a node's single preview slot shows:
 * - `"auto"` — TIER-AWARE (ticket nid_k2pa8khm6ugozmhkd6nlbdrq6_e). On a CENTRAL
 *   ({@link GraphNode.isCentral} — MAIN and every pinned root) document position
 *   decides: the image wins iff it sits above the first heading (the documented
 *   "show the picture instead" hatch). On an ordinary neighbour the outline is
 *   NOT offered at all — the ladder is first image, else nothing — so a
 *   headings-only neighbour is title-only and never claims the slot.
 * - `"outline"` — prefer the outline for EVERY node, overriding both document
 *   position and the tier rule.
 * - `"image"` — prefer the first image for every node, same overriding scope.
 *
 * Under an EXPLICIT preference a note offering only one region always shows that
 * one (a preference never empties a node); under `"auto"` that holds for centrals
 * only, by design — see `nodePreviewKind` for the WHY.
 *
 * The precedence rule itself is engine-owned (`nodePreviewKind`) because the
 * content-fit sizer needs the same decision the view renders by; the view's
 * mapping calls the same function.
 */
export type NodePreviewPreference = "auto" | "title-only" | "outline" | "image";

/**
 * THE value list of {@link NodePreviewPreference}, in the order the segmented
 * control renders them left-to-right. Single-sourced: persistence validates
 * against it and the UI derives its option order from it.
 */
export const NODE_PREVIEW_PREFERENCES = [
	"auto",
	"title-only",
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
// Per-node overrides (persisted in `data.json`, keyed by docid — like pins).
// NOT a per-document settings layer (killed 2026-07-29): an override is a
// global fact about one doc, applied from ANY central. See
// docs-internal/plan/node-sizing-rethink.md.
// ---------------------------------------------------------------------------

/**
 * Pixel box a user drag-resize committed for one node. Q3 (decided 2026-08-03):
 * it may exceed the global `maxPx` dial or undercut `minPx` — the user's
 * per-node intent is the MOST explicit — bounded only by the hard sanity bounds
 * (`clampNodeSizeOverridePx`).
 */
export interface NodeSizeOverridePx {
	readonly widthPx: number;
	readonly heightPx: number;
}

/**
 * Per-node content override: the {@link NodePreviewPreference} values MINUS
 * `"auto"` — "Inherit" (fall back to the global preference, which may itself be
 * `"auto"`) is expressed by ABSENCE of the field, never by a stored value.
 *
 * `"auto"` is the ONLY exclusion: it is not a concrete region, it IS the
 * "decide per document/tier" rule the override exists to opt OUT of, so a stored
 * `"auto"` would be indistinguishable from Inherit. `"title-only"` IS a per-node
 * choice (owner decision 2026-08-04, ticket nid_9hx6okamx3yt0rg9iad2f4151_e):
 * the hover gear offers [Inherit | Title only | Outline | Image].
 */
export type NodeContentOverride = Exclude<NodePreviewPreference, "auto">;

/**
 * THE value list of {@link NodeContentOverride}, in the order the hover gear menu
 * renders them (after "Inherit") — persistence validates stored values against it
 * (same single-sourcing as {@link NODE_PREVIEW_PREFERENCES}).
 */
export const NODE_CONTENT_OVERRIDES = [
	"title-only",
	"outline",
	"image",
] as const satisfies readonly NodeContentOverride[];

/**
 * Compile-time completeness: a preference added to {@link NodePreviewPreference}
 * (e.g. the planned `title-only`) surfaces here as a type error until it is
 * either listed as an override choice or explicitly excluded above.
 */
type UnlistedContentOverride = Exclude<NodeContentOverride, (typeof NODE_CONTENT_OVERRIDES)[number]>;
export const _assertEveryNodeContentOverrideListed: UnlistedContentOverride extends never
	? true
	: UnlistedContentOverride = true;

/**
 * Everything a user overrode on ONE node. Both fields optional; an override
 * with NEITHER field is never stored — the persistence layer deletes the entry
 * (reset returns the node to inherit everything, no orphan lingers).
 */
export interface NodeOverride {
	readonly sizePx?: NodeSizeOverridePx;
	readonly content?: NodeContentOverride;
}

// ---------------------------------------------------------------------------
// Settings shapes (persisted by step-03 in `data.json`). GLOBAL-only: there is
// no per-doc override layer — one value drives every root and every view.
// ---------------------------------------------------------------------------

/**
 * The per-channel depth budgets ONE traversal root walks with — one budget per
 * {@link Channel}, wired by {@link CHANNEL_DEPTH_FIELD}. This is the shape the
 * BFS consumes; WHICH budgets a root gets (active-note vs pinned — see
 * {@link DepthSettings}) is resolved by the engine facade before traversal.
 */
export interface ChannelDepths {
	/** Hops of PLAIN outgoing links (`[[x]]`, `[x](y)`) expanded from this root. */
	readonly linkDepthOut: number;
	/**
	 * Hops of EMBEDDED outgoing notes (`![[x]]`, canvas file nodes) expanded from
	 * this root. Embedded ATTACHMENTS are not affected: attachment-ness is decided
	 * by node-bearing-ness, never by kind (owner decision D5), so a `![[chart.png]]`
	 * is an attachment exactly like `[[chart.png]]` and never consumes this budget.
	 */
	readonly embedDepthOut: number;
	/**
	 * Hops of incoming links expanded from this root. KIND-BLIND by scope decision:
	 * a note that embeds a central note arrives here like any other linker — there
	 * is deliberately no "embedded in" budget.
	 */
	readonly linkDepthIn: number;
}

/**
 * The GLOBAL depth settings family (persisted as `globalDepths`): the base
 * fields are the ACTIVE note's budgets, the `pinned*` fields are the budgets
 * every PINNED note traverses with instead (ticket
 * `nid_ts4rx2pfo6o18verzk07z16g8_e` — one dial per role, still no per-note
 * layer). A pinned note that is also the active note uses the active-note
 * budgets: the assembler drops such a pin before the engine sees it, and the
 * traversal's MAIN-first dedupe backstops it.
 *
 * FLAT fields rather than a nested `{active, pinned}` pair, deliberately: every
 * settings mechanism in this repo (row declarations, the write plan's one-field
 * merge, the persistence field parser, the section/reset tables) is keyed by
 * `keyof DepthSettings`, and flat fields ride all of it unchanged.
 */
export interface DepthSettings extends ChannelDepths {
	/** {@link ChannelDepths.linkDepthOut}, for pinned roots. */
	readonly pinnedLinkDepthOut: number;
	/** {@link ChannelDepths.embedDepthOut}, for pinned roots. */
	readonly pinnedEmbedDepthOut: number;
	/** {@link ChannelDepths.linkDepthIn}, for pinned roots. */
	readonly pinnedLinkDepthIn: number;
}

/**
 * Projections of {@link DepthSettings} onto the {@link ChannelDepths} one root
 * traverses with — the ONE place the role → fields mapping lives.
 */
export class DepthSettingsFacts {
	/** The active (MAIN) note's budgets. Explicit projection: never hand the 6-field object to a root. */
	static activeChannelDepths(settings: DepthSettings): ChannelDepths {
		return {
			linkDepthOut: settings.linkDepthOut,
			embedDepthOut: settings.embedDepthOut,
			linkDepthIn: settings.linkDepthIn,
		};
	}

	/** The budgets every pinned root traverses with. */
	static pinnedChannelDepths(settings: DepthSettings): ChannelDepths {
		return {
			linkDepthOut: settings.pinnedLinkDepthOut,
			embedDepthOut: settings.pinnedEmbedDepthOut,
			linkDepthIn: settings.pinnedLinkDepthIn,
		};
	}
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
 * Single source of truth mapping a {@link Channel} to the {@link ChannelDepths}
 * budget it spends. Read by the traversal only — a settings row names its FIELD
 * directly, so this stays the BFS's own table.
 *
 * `Record<Channel, …>`, so a new channel cannot ship without deciding which budget
 * limits it. POLS — trivially invertible.
 */
export const CHANNEL_DEPTH_FIELD: Readonly<Record<Channel, keyof ChannelDepths>> = {
	"outgoing-link": "linkDepthOut",
	"outgoing-embed": "embedDepthOut",
	incoming: "linkDepthIn",
};

/**
 * Node sizing configuration: the CLAMPS on the content-fit size.
 *
 * The metric dials (own-file-size, total-linker-size, backlink-count,
 * outlink-count, depth-decay) were REMOVED outright (owner decision 2026-08-03,
 * node-sizing rethink Q1): a node's default size fits the content it actually
 * shows — title, renderable outline lines, or thumbnail — and these two dials
 * bound that fit. See {@link import("./NodeSizer").NodeSizer}.
 */
export interface SizingSettings {
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
	/**
	 * Draw EVERY link between two visible nodes, not only the links the BFS walked
	 * (see {@link import("./CrossLinkSweep").CrossLinkSweep}). Affects EDGES only —
	 * which nodes are visible is decided before this is read.
	 */
	readonly showCrossLinks: boolean;
	/**
	 * The ONE master switch for EVERY external-content preview a node can show —
	 * the leading YouTube hero video today, external images / other providers
	 * later. It is a PRIVACY gate, not a layout knob: ON (the shipped default, so
	 * the feature works out of the box) lets the view load content referenced in
	 * notes from third-party servers (e.g. YouTube/Google — embeds, posters, and
	 * future thumbnail/favicon fetches); OFF stops ALL such requests, so nothing
	 * external is ever contacted.
	 *
	 * ONE switch, not per-provider (KISS): the disclosure a user consents to is
	 * "external content is loaded", and that is a single yes/no. The actual
	 * enforcement seam that reads this lands with a later ticket
	 * (`nid_tvtm9gj5zaj4tbfbpti3v6sy2_e`); this field is the setting it consults.
	 */
	readonly externalPreviews: boolean;
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
	 * (0 when exclusion is disabled/empty). Surfaced in the controls panel's
	 * node-exclusion section header, so it stays visible while that section is closed.
	 */
	readonly excludedNodeCount: number;
	/** The view settings the build actually used (post cascade resolution). */
	readonly viewSettings: ViewSettings;
}
