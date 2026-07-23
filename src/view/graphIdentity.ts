import type { DirectedLink, GraphNode } from "../engine";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import { estimateNodeLabelWidthPx } from "./constants";

/**
 * Structural identity helpers shared by the React-Flow mapping, the elk mapping
 * and the structural diff. Single source of the conventions those three modules
 * must agree on: how an edge is identified, how a node's rendered box is sized,
 * and whether a node shows a `folder/` breadcrumb. Pure — safe for node tests.
 */

/**
 * Engine edges carry no id (a {@link DirectedLink} is `{source, target}`);
 * React Flow and elk both require one. Synthesized from the ordered pair —
 * deterministic and unique because the engine deduplicates edges per
 * `(source, target)`.
 */
export function edgeIdOf(edge: DirectedLink): string {
	return `${edge.source}->${edge.target}`;
}

/**
 * Node ids are vault paths, so folder-group ids need a namespace that no note
 * id occupies. WHY this prefix is safe: a collision would require a FILE whose
 * vault path literally starts with "folder-group:" AND matches a rendered
 * folder — deemed improbable enough for V1 (documented trade-off).
 */
const FOLDER_GROUP_ID_PREFIX = "folder-group:";

/** Shared RF/elk id of the group node rendered for `folder`. */
export function folderGroupIdOf(folder: string): string {
	return `${FOLDER_GROUP_ID_PREFIX}${folder}`;
}

/** True for ids minted by {@link folderGroupIdOf} — group nodes never open notes. */
export function isFolderGroupId(id: string): boolean {
	return id.startsWith(FOLDER_GROUP_ID_PREFIX);
}

/** Vault root has no folder identity, so its files never show a breadcrumb. */
const VAULT_ROOT_FOLDER = "";

/**
 * The muted `folder/` breadcrumb rendered before an UNGROUPED, non-root node's
 * title. `undefined` when the node is grouped (its folder identity comes from
 * the group box) or lives at the vault root. Derived HERE so the elk mapping and
 * the flow mapping agree on both the rendered prefix and the width it demands.
 */
export function breadcrumbFolderOf(node: GraphNode, isGrouped: boolean): string | undefined {
	if (isGrouped || node.folder === VAULT_ROOT_FOLDER) {
		return undefined;
	}
	return VaultPathFacts.folderNameOf(node.folder);
}

/** Rendered box of a note node. */
export interface NodeDimensions {
	readonly width: number;
	readonly height: number;
}

/**
 * Rendered box of a note node. HEIGHT stays the engine's diff-stable, score-
 * driven `sizePx`; WIDTH is floored so the full label (breadcrumb + title)
 * renders without an ellipsis — a long name grows the node WIDER, not taller,
 * and may exceed the engine's max size. Both the elk input and the React Flow
 * node MUST use the SAME numbers or layout positions and rendered boxes drift.
 */
export function nodeDimensionsPx(node: GraphNode, breadcrumbFolder: string | undefined): NodeDimensions {
	return {
		width: Math.max(node.sizePx, estimateNodeLabelWidthPx(node.title, breadcrumbFolder)),
		height: node.sizePx,
	};
}
