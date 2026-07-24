import type { AttachmentRef, FolderPath, OutlineEntry, VaultPath } from "./types";

/**
 * Per-file facts the engine needs. Everything here is ADAPTER truth: the
 * provider (not the engine) owns eligibility and attachment rules, because
 * only the adapter can consult real vault knowledge (extensions, embeds,
 * canvas capability). The engine merely consumes these flags.
 */
export interface FileMetadata {
	readonly folder: FolderPath;
	readonly sizeBytes: number;
	/**
	 * Display-title override from the note's frontmatter (`title` property,
	 * else `name` — step-05 human decision); absent when neither is a
	 * non-empty string. The engine falls back to the basename.
	 */
	readonly frontmatterTitle?: string;
	/**
	 * True iff this file can be a graph node (adapter rule: `.md` + `.canvas`).
	 * Non-node-bearing files are never nodes — they surface as attachments.
	 */
	readonly isNodeBearing: boolean;
	/**
	 * Non-node-bearing files this file references, in reference order.
	 * Provider-owned so adapters can refine the rule (e.g. embeds vs. plain
	 * links) without an engine change (OCP).
	 */
	readonly attachments: readonly AttachmentRef[];
	/**
	 * Heading outline offered as this note's in-node preview, in document order.
	 * EMPTY when the file has no headings, is not outline-bearing (canvas,
	 * `*.excalidraw.md`), or when its FIRST IMAGE appears BEFORE its first
	 * heading — the human's documented "show the picture instead" escape hatch.
	 * Nothing downstream can act on the difference between those cases: all three
	 * mean "do not offer an outline for this note". Provider-owned exactly like
	 * {@link attachments}: only the adapter sees document offsets.
	 */
	readonly outline: readonly OutlineEntry[];
}

/**
 * THE sole seam between the pure engine and Obsidian. Synchronous by design
 * (binding decision, step-02 CLARIFICATION Q2): adapters index up-front
 * (async construction), then answer queries synchronously.
 *
 * Step-03 implements `ObsidianLinkProvider` (resolvedLinks + backlinks) AND a
 * canvas-fallback provider against this SAME interface — keep it shaped around
 * path-keyed link lists + per-file metadata, never canvas-specific (OCP).
 */
export interface LinkProvider {
	/** Resolved link targets of `path`, in reference order, deduplicated. May include non-node-bearing files. */
	getOutgoingLinks(path: VaultPath): readonly VaultPath[];
	/** Paths of files linking TO `path`, deduplicated. */
	getIncomingLinks(path: VaultPath): readonly VaultPath[];
	/** Metadata for `path`, or `undefined` when the file is unknown to the vault. */
	getFileMetadata(path: VaultPath): FileMetadata | undefined;
	/**
	 * Number of distinct resolved links `source` → `target`; 0 when none. The
	 * ONLY multiplicity source: link lists above are deduplicated, and the
	 * traversal cannot tally links itself (multi-root walks revisit pairs), so
	 * edge count badges must come from here.
	 */
	getLinkCount(source: VaultPath, target: VaultPath): number;
}
