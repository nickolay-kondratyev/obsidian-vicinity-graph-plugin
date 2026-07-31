import type {
	BacklinkSourceOccurrences,
	LinkOccurrence,
	OutgoingLinkOccurrence,
	OutlineEntry,
	VaultPath,
} from "../engine";

/**
 * Pure view-models for the link-preview modal (parent ticket
 * `nid_tohotgq2s92dvd1iov1rd0umv_e`): what a NODE click and an EDGE click show.
 * Builders take occurrence DATA (from `LinkOccurrenceProvider`) and outline
 * DATA (from `FileMetadata.outline` — never re-derived here) and produce rows
 * with stable ids; the collapse/expand state machine
 * (`src/view/contextRowCollapse.ts`) is keyed by those ids.
 */

/** One expandable context row of the modal: one link occurrence. */
export interface ContextRow<TOccurrence extends LinkOccurrence = LinkOccurrence> {
	/**
	 * Stable identity WITHIN one built model — group-qualified, so the collapse
	 * state survives a re-render of the same model but is never shared across
	 * two different occurrences.
	 */
	readonly rowId: string;
	readonly occurrence: TOccurrence;
}

/** Backlinks from ONE source note, in that source's document order. */
export interface BacklinkGroupModel {
	readonly sourcePath: VaultPath;
	/** Non-empty, mirroring `BacklinkSourceOccurrences.occurrences`. */
	readonly rows: readonly ContextRow[];
}

/** What the node-click modal renders for a note, sections in display order. */
export interface NodePreviewModel {
	readonly kind: "node";
	readonly path: VaultPath;
	/** The note's heading outline, verbatim from `FileMetadata.outline`. */
	readonly outline: readonly OutlineEntry[];
	/** The note's OUTGOING occurrences, in the note's document order. */
	readonly linkRows: readonly ContextRow<OutgoingLinkOccurrence>[];
	/** Backlink groups ordered by source path (the provider's order is not deterministic). */
	readonly backlinkGroups: readonly BacklinkGroupModel[];
	/** Every context row id, in display order — the collapse state's row universe. */
	readonly rowIds: readonly string[];
}

/** What the edge-click modal renders: ONLY the occurrences under source → target. */
export interface EdgePreviewModel {
	readonly kind: "edge";
	readonly sourcePath: VaultPath;
	readonly targetPath: VaultPath;
	/** In the source note's document order. */
	readonly rows: readonly ContextRow[];
	/** Every context row id, in display order — the collapse state's row universe. */
	readonly rowIds: readonly string[];
}

export interface NodePreviewInputs {
	readonly path: VaultPath;
	readonly outline: readonly OutlineEntry[];
	/** `LinkOccurrenceProvider.outgoingOccurrences(path)` — document order. */
	readonly outgoing: readonly OutgoingLinkOccurrence[];
	/** `LinkOccurrenceProvider.backlinkOccurrences(path)` — any group order. */
	readonly backlinks: readonly BacklinkSourceOccurrences[];
}

export interface EdgePreviewInputs {
	readonly sourcePath: VaultPath;
	readonly targetPath: VaultPath;
	/** `LinkOccurrenceProvider.occurrencesBetween(source, target)` — already edge-scoped. */
	readonly occurrences: readonly LinkOccurrence[];
}

/** THE one place the modal's grouping + ordering rules live. */
export class LinkPreviewModels {
	static node({ path, outline, outgoing, backlinks }: NodePreviewInputs): NodePreviewModel {
		const linkRows = outgoing.map((occurrence, index) => ({
			rowId: `links:${index}`,
			occurrence,
		}));
		// Code-point sort on source path: deterministic and locale-independent —
		// the adapter's group order follows a cache map's iteration order.
		const backlinkGroups = [...backlinks]
			.sort((a, b) => (a.sourcePath < b.sourcePath ? -1 : a.sourcePath > b.sourcePath ? 1 : 0))
			.map((group) => ({
				sourcePath: group.sourcePath,
				rows: group.occurrences.map((occurrence, index) => ({
					rowId: `backlink:${group.sourcePath}:${index}`,
					occurrence,
				})),
			}));
		return {
			kind: "node",
			path,
			outline,
			linkRows,
			backlinkGroups,
			rowIds: [...linkRows, ...backlinkGroups.flatMap((group) => group.rows)].map((row) => row.rowId),
		};
	}

	static edge({ sourcePath, targetPath, occurrences }: EdgePreviewInputs): EdgePreviewModel {
		const rows = occurrences.map((occurrence, index) => ({
			rowId: `edge:${index}`,
			occurrence,
		}));
		return {
			kind: "edge",
			sourcePath,
			targetPath,
			rows,
			rowIds: rows.map((row) => row.rowId),
		};
	}
}
