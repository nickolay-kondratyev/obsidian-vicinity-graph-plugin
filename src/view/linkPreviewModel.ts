import type { LinkOccurrence, VaultPath } from "../engine";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import { folderOfGroupId, isFolderGroupId } from "./graphIdentity";

/**
 * Pure view-model for the EDGE-click link preview (parent ticket
 * `nid_tohotgq2s92dvd1iov1rd0umv_e`): what an edge click shows. The builder
 * takes occurrence DATA (from `LinkOccurrenceProvider`) and produces rows with
 * stable ids; the collapse/expand state machine
 * (`src/view/contextRowCollapse.ts`) is keyed by those ids.
 */

/** One expandable context row of the preview: one link occurrence. */
export interface ContextRow {
	/**
	 * Stable identity WITHIN one built model — group-qualified, so the collapse
	 * state survives a re-render of the same model but is never shared across
	 * two different occurrences.
	 */
	readonly rowId: string;
	readonly occurrence: LinkOccurrence;
}

/** One from→to group of the edge preview: the rows of ONE contributing note pair. */
export interface EdgePairGroupModel {
	readonly sourcePath: VaultPath;
	readonly targetPath: VaultPath;
	/** In the pair's SOURCE note's document order. */
	readonly rows: readonly ContextRow[];
}

/**
 * One folder-note HIERARCHY relation the clicked edge carries: the FLYOUT's
 * explanation of a parent → child folder relation (plan
 * `nid_ri1d36t7hmhu0kr652wny1dmz_e` decision 6). Derived purely from the pair's
 * paths — the source is the folder note (parent), the target a note directly
 * inside its owned folder. Names carry the extension (`Jon.md`) so the sentence
 * reads as the vault does.
 */
export interface FolderRelationModel {
	/** Folder note file name, extension included — e.g. `Jon.md`. */
	readonly folderNoteName: string;
	/** Owned folder's display name — e.g. `Jon` (the child lives directly in it). */
	readonly folderName: string;
	/** Child note file name, extension included — e.g. `child-of-jon.md`. */
	readonly childName: string;
}

/**
 * What the edge-click preview renders: occurrence groups per contributing
 * note→note pair. ONE group for a plain note→note edge; several when the
 * clicked visual is a group-collapsed edge unioning many pairs (and possibly
 * both directions — ticket `nid_tiitgrp5bt7g2niwcvthxw1jk_e`).
 */
export interface EdgePreviewModel {
	/** Display name of the clicked visual's endpoints (note title or folder name). */
	readonly sourceName: string;
	readonly targetName: string;
	/** True when the clicked visual unions BOTH directions (collapsed bidirectional edge). */
	readonly bidirectional: boolean;
	/** Sorted by (sourcePath, targetPath) code points — deterministic display order. */
	readonly pairs: readonly EdgePairGroupModel[];
	/**
	 * The folder-note hierarchy relations this edge carries, one per contributing
	 * pair keyed `hierarchy`, in the same (sourcePath, targetPath) order as
	 * {@link pairs}. Empty for a link-only edge; a PURE hierarchy edge has these
	 * and no {@link pairs} rows (the explanation IS the content); a MERGED edge has
	 * both.
	 */
	readonly folderRelations: readonly FolderRelationModel[];
	/** Every context row id, in display order — the collapse state's row universe. */
	readonly rowIds: readonly string[];
}

/** Occurrences of ONE contributing note→note pair of a clicked edge visual. */
export interface EdgePairOccurrences {
	readonly sourcePath: VaultPath;
	readonly targetPath: VaultPath;
	/** `LinkOccurrenceProvider.occurrencesBetween(sourcePath, targetPath)` — already pair-scoped. */
	readonly occurrences: readonly LinkOccurrence[];
	/**
	 * True iff this pair carries the folder-note hierarchy relation (parent →
	 * child; {@link import("./flowMapping").EdgeNotePair.hierarchy}). Drives the
	 * flyout's folder-relation section; orthogonal to {@link occurrences} (a merged
	 * pair has both).
	 */
	readonly hierarchy: boolean;
}

export interface EdgePreviewInputs {
	/** Display name of the clicked visual's endpoints (note title or folder name). */
	readonly sourceName: string;
	readonly targetName: string;
	readonly bidirectional: boolean;
	/** One entry per contributing pair (`FlowEdge.notePairs`), any order. */
	readonly pairs: readonly EdgePairOccurrences[];
}

/**
 * The folder-note relation a hierarchy pair explains, derived purely from its
 * paths: the source note is the folder note, the target lives directly in the
 * folder note's owned folder (so the folder is the target's own folder). Names
 * keep the extension to read like the vault.
 */
function folderRelationOf(pair: EdgePairOccurrences): FolderRelationModel {
	return {
		folderNoteName: VaultPathFacts.basenameOf(pair.sourcePath),
		folderName: VaultPathFacts.folderNameOf(VaultPathFacts.folderOf(pair.targetPath)),
		childName: VaultPathFacts.basenameOf(pair.targetPath),
	};
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
	static edge({ sourceName, targetName, bidirectional, pairs }: EdgePreviewInputs): EdgePreviewModel {
		// Code-point sort on (source, target) path: deterministic and
		// locale-independent — the caller's pair order follows engine edge
		// iteration, which is not a display order.
		const sortedPairs = [...pairs].sort(
			(a, b) => comparePaths(a.sourcePath, b.sourcePath) || comparePaths(a.targetPath, b.targetPath),
		);
		const groups = sortedPairs.map((pair, pairIndex) => ({
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
			sourceName,
			targetName,
			bidirectional,
			pairs: groups,
			// Same sorted order as `pairs`; only the hierarchy-carrying pairs explain
			// a folder relation (a link-only pair contributes none).
			folderRelations: sortedPairs.filter((pair) => pair.hierarchy).map(folderRelationOf),
			rowIds: groups.flatMap((group) => group.rows).map((row) => row.rowId),
		};
	}
}
