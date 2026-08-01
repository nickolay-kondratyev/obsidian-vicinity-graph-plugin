import type { DirectedLink, GraphNode } from "../engine";
import { NODE_MAX_LABEL_WIDTH_PX, estimateNodeLabelWidthPx } from "./constants";

/**
 * Structural identity helpers shared by the React-Flow mapping, the elk mapping
 * and the structural diff. Single source of the conventions those three modules
 * must agree on: how an edge is identified and how a node's rendered box is
 * sized. Pure — safe for node tests.
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

/** Inverse of {@link folderGroupIdOf}: the folder path behind a group id. */
export function folderOfGroupId(id: string): string {
	return id.slice(FOLDER_GROUP_ID_PREFIX.length);
}

/** Rendered box of a note node. */
export interface NodeDimensions {
	readonly width: number;
	readonly height: number;
}

/**
 * Rendered box of a note node. HEIGHT stays the engine's diff-stable, score-
 * driven `sizePx`. WIDTH is the snug label estimate, floored at the score-driven
 * square (`sizePx`) and capped at {@link NODE_MAX_LABEL_WIDTH_PX} — a longer
 * title stops widening the node and wraps onto the further lines the title CSS
 * allows. Both the elk input and the React Flow node MUST use the SAME numbers
 * or layout positions and rendered boxes drift.
 */
export function nodeDimensionsPx(node: GraphNode): NodeDimensions {
	return {
		width: Math.max(node.sizePx, Math.min(NODE_MAX_LABEL_WIDTH_PX, estimateNodeLabelWidthPx(node.title))),
		height: node.sizePx,
	};
}
