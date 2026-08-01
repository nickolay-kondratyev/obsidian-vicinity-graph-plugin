import type {
	BacklinkSourceOccurrences,
	LinkOccurrence,
	OutgoingLinkOccurrence,
	OutlineEntry,
	VaultPath,
} from "../engine";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import { folderOfGroupId, isFolderGroupId } from "./graphIdentity";

/**
 * Pure view-models for the link preview (parent ticket
 * `nid_tohotgq2s92dvd1iov1rd0umv_e`): what a NODE click and an EDGE click show.
 * Builders take occurrence DATA (from `LinkOccurrenceProvider`) and outline
 * DATA (from `FileMetadata.outline` — never re-derived here) and produce rows
 * with stable ids; the collapse/expand state machine
 * (`src/view/contextRowCollapse.ts`) is keyed by those ids.
 */

/** One expandable context row of the preview: one link occurrence. */
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

/** What the node-click preview renders for a note, sections in display order. */
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

/** One from→to group of the edge preview: the rows of ONE contributing note pair. */
export interface EdgePairGroupModel {
	readonly sourcePath: VaultPath;
	readonly targetPath: VaultPath;
	/** In the pair's SOURCE note's document order. */
	readonly rows: readonly ContextRow[];
}

/**
 * What the edge-click preview renders: occurrence groups per contributing
 * note→note pair. ONE group for a plain note→note edge; several when the
 * clicked visual is a group-collapsed edge unioning many pairs (and possibly
 * both directions — ticket `nid_tiitgrp5bt7g2niwcvthxw1jk_e`).
 */
export interface EdgePreviewModel {
	readonly kind: "edge";
	/** Display name of the clicked visual's endpoints (note title or folder name). */
	readonly sourceName: string;
	readonly targetName: string;
	/** True when the clicked visual unions BOTH directions (collapsed bidirectional edge). */
	readonly bidirectional: boolean;
	/** Sorted by (sourcePath, targetPath) code points — deterministic display order. */
	readonly pairs: readonly EdgePairGroupModel[];
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

/** Either preview payload — what `LinkPreviewDrawer` hosts and the content renders. */
export type LinkPreviewModel = NodePreviewModel | EdgePreviewModel;

/** Occurrences of ONE contributing note→note pair of a clicked edge visual. */
export interface EdgePairOccurrences {
	readonly sourcePath: VaultPath;
	readonly targetPath: VaultPath;
	/** `LinkOccurrenceProvider.occurrencesBetween(sourcePath, targetPath)` — already pair-scoped. */
	readonly occurrences: readonly LinkOccurrence[];
}

export interface EdgePreviewInputs {
	/** Display name of the clicked visual's endpoints (note title or folder name). */
	readonly sourceName: string;
	readonly targetName: string;
	readonly bidirectional: boolean;
	/** One entry per contributing pair (`FlowEdge.notePairs`), any order. */
	readonly pairs: readonly EdgePairOccurrences[];
}

/** Code-point comparison — deterministic, locale-independent path ordering. */
function comparePaths(a: VaultPath, b: VaultPath): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Display name of a rendered edge endpoint id — the drawer-title vocabulary:
 * the FOLDER name for a folder-group id (a collapsed edge's endpoint), the note
 * title otherwise.
 */
export function edgeEndpointDisplayName(id: string): string {
	return isFolderGroupId(id) ? VaultPathFacts.folderNameOf(folderOfGroupId(id)) : VaultPathFacts.titleOf(id);
}

/** THE one place the preview's grouping + ordering rules live. */
export class LinkPreviewModels {
	static node({ path, outline, outgoing, backlinks }: NodePreviewInputs): NodePreviewModel {
		const linkRows = outgoing.map((occurrence, index) => ({
			rowId: `links:${index}`,
			occurrence,
		}));
		// Code-point sort on source path: deterministic and locale-independent —
		// the adapter's group order follows a cache map's iteration order.
		const backlinkGroups = [...backlinks]
			.sort((a, b) => comparePaths(a.sourcePath, b.sourcePath))
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

	static edge({ sourceName, targetName, bidirectional, pairs }: EdgePreviewInputs): EdgePreviewModel {
		// Code-point sort on (source, target) path: deterministic and
		// locale-independent — the caller's pair order follows engine edge
		// iteration, which is not a display order.
		const groups = [...pairs]
			.sort(
				(a, b) =>
					comparePaths(a.sourcePath, b.sourcePath) || comparePaths(a.targetPath, b.targetPath),
			)
			.map((pair, pairIndex) => ({
				sourcePath: pair.sourcePath,
				targetPath: pair.targetPath,
				// Index-based ids stay unique across pairs (pairs are distinct ordered
				// pairs) without assuming anything about path contents.
				rows: pair.occurrences.map((occurrence, index) => ({
					rowId: `edge:${pairIndex}:${index}`,
					occurrence,
				})),
			}));
		return {
			kind: "edge",
			sourceName,
			targetName,
			bidirectional,
			pairs: groups,
			rowIds: groups.flatMap((group) => group.rows).map((row) => row.rowId),
		};
	}
}
