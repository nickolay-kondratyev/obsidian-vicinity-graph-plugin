import type { DirectedLink, GraphNode } from "../engine";

/**
 * Structural identity helpers shared by the React-Flow mapping, the elk mapping
 * and the structural diff. Single source of the two conventions those three
 * modules must agree on: how an edge is identified, and how a node's on-screen
 * side length is derived. Pure — safe for node tests.
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

/**
 * Nodes render (and lay out) as squares of the engine's diff-stable `sizePx`.
 * Both the elk input and the React Flow node must use the SAME number or layout
 * positions and rendered boxes drift apart.
 */
export function nodeSideLengthPx(node: GraphNode): number {
	return node.sizePx;
}
