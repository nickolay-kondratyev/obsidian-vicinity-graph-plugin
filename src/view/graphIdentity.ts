import type { DirectedLink, GraphNode, NodeSizeOverridePx } from "../engine";
import { NODE_MAX_LABEL_WIDTH_PX, estimateNodeLabelWidthPx } from "../engine";
import type { TagKey } from "../shared/Tags";
import { Tags } from "../shared/Tags";
import type { GroupId } from "./grouping";
import { asGroupId } from "./grouping";

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

/**
 * Shared RF/elk id of the group node rendered for `folder` — the folder
 * grouper's {@link GroupId} mint. Unchanged across rebuilds, so the structural
 * diff never sees a folder box as new.
 */
export function folderGroupIdOf(folder: string): GroupId {
	return asGroupId(`${FOLDER_GROUP_ID_PREFIX}${folder}`);
}

/** True for ids minted by {@link folderGroupIdOf} — group nodes never open notes. */
export function isFolderGroupId(id: string): boolean {
	return id.startsWith(FOLDER_GROUP_ID_PREFIX);
}

/** Inverse of {@link folderGroupIdOf}: the folder path behind a group id. */
export function folderOfGroupId(id: string): string {
	return id.slice(FOLDER_GROUP_ID_PREFIX.length);
}

/**
 * Tag-group ids get their own namespace (same collision trade-off as
 * {@link FOLDER_GROUP_ID_PREFIX}). Code asking "is this a box, not a note?" asks
 * {@link isGroupId}, which recognises both namespaces.
 */
const TAG_GROUP_ID_PREFIX = "tag-group:";
/** Joins the keys of ONE box's tag set. A space never occurs inside a tag. */
const TAG_GROUP_SET_SEPARATOR = " ";
/** Joins the boxes of the chain from the outermost box down. `>` never occurs inside a tag. */
const TAG_GROUP_LEVEL_SEPARATOR = " > ";

/**
 * Shared RF/elk id of a tag box, minted from the tag-key SETS of the box chain
 * (outermost first, each set sorted). The same set can box at two places in the
 * tree (a nested `#vital` and a top-level `#vital`), so the chain — not the box's
 * own set — is what makes the id unique; it is stable across rebuilds of the
 * same grouping.
 */
export function tagGroupIdOf(tagKeySetChain: readonly (readonly string[])[]): GroupId {
	const levels = tagKeySetChain.map((keys) => keys.join(TAG_GROUP_SET_SEPARATOR));
	return asGroupId(`${TAG_GROUP_ID_PREFIX}${levels.join(TAG_GROUP_LEVEL_SEPARATOR)}`);
}

/** True for ids minted by {@link tagGroupIdOf}. */
export function isTagGroupId(id: string): boolean {
	return id.startsWith(TAG_GROUP_ID_PREFIX);
}

/**
 * True for ANY group box id, whatever grouper minted it — the question callers that
 * must not treat a box as a note (open it, re-centre on it) ask.
 */
export function isGroupId(id: string): boolean {
	return isFolderGroupId(id) || isTagGroupId(id);
}

/**
 * The `#tag` label of the box behind a tag-group id: its OWN (innermost) set, minus
 * any parent tag implied by a nested child in it — the same label rule
 * `tagGrouping.ts` applies, recovered from the id because an edge endpoint carries
 * only the id. Spelled with the KEYS (lower-cased): the id holds no display casing.
 */
export function tagGroupLabelOf(id: string): string {
	const levels = id.slice(TAG_GROUP_ID_PREFIX.length).split(TAG_GROUP_LEVEL_SEPARATOR);
	const ownKeys = (levels[levels.length - 1] ?? "").split(TAG_GROUP_SET_SEPARATOR) as TagKey[];
	return ownKeys
		.filter((key) => !ownKeys.some((other) => other !== key && Tags.isSameOrNestedUnder(other, key)))
		.map((key) => `#${key}`)
		.join(" ");
}

/** Rendered box of a note node. */
export interface NodeDimensions {
	readonly width: number;
	readonly height: number;
}

/**
 * The user's stored size for this node, or `undefined` when its box is computed.
 * ONE definition of "a size override shapes this node": {@link nodeDimensionsPx}
 * applies it and the flow mapping reports it as the fact the "Reset size" menu
 * entry switches on — a second reading of `override.sizePx` would be free to
 * disagree with the box actually rendered.
 */
export function nodeSizeOverridePx(node: GraphNode): NodeSizeOverridePx | undefined {
	return node.override?.sizePx;
}

/**
 * Every field of a size override, derived from the TYPE rather than hand-listed:
 * the table is `Record<keyof NodeSizeOverridePx, …>`, so a future field is
 * compile-forced into it and automatically compared by
 * {@link sameNodeSizeOverridePx} (a hand-written field list could silently
 * ignore one, leaving that dimension unable to trigger a relayout).
 */
const NODE_SIZE_OVERRIDE_FIELDS = Object.keys({
	widthPx: true,
	heightPx: true,
} satisfies Record<keyof NodeSizeOverridePx, true>) as readonly (keyof NodeSizeOverridePx)[];

/**
 * ONE definition of "these two nodes carry the same stored size" — `undefined`
 * (no override) is a value here, so gaining and losing an override both read as
 * a difference. Compared by VALUE, never identity: every rebuild resolves a
 * FRESH override object out of `data.json`, so identity would report a change
 * on every unrelated rebuild.
 */
export function sameNodeSizeOverridePx(
	a: NodeSizeOverridePx | undefined,
	b: NodeSizeOverridePx | undefined,
): boolean {
	if (a === undefined || b === undefined) {
		return a === b;
	}
	return NODE_SIZE_OVERRIDE_FIELDS.every((field) => a[field] === b[field]);
}

/**
 * Rendered box of a note node. A user size override wins outright (Q3: the
 * per-node intent is the MOST explicit — it may exceed the label cap or the
 * global sizing dials; hard sanity bounds were already applied by
 * `clampNodeSizeOverridePx` on the store's write AND load paths, so the value
 * is used verbatim here). Otherwise HEIGHT is the engine's diff-stable,
 * content-fit `sizePx`, and WIDTH is the snug label estimate, floored at the
 * content-fit square (`sizePx`) and capped at {@link NODE_MAX_LABEL_WIDTH_PX}
 * — a longer title stops widening the node and wraps onto the further lines
 * the title CSS allows. Both the elk input and the React Flow node MUST use
 * the SAME numbers or layout positions and rendered boxes drift.
 */
export function nodeDimensionsPx(node: GraphNode): NodeDimensions {
	const overridePx = nodeSizeOverridePx(node);
	if (overridePx !== undefined) {
		return { width: overridePx.widthPx, height: overridePx.heightPx };
	}
	return {
		width: Math.max(node.sizePx, Math.min(NODE_MAX_LABEL_WIDTH_PX, estimateNodeLabelWidthPx(node))),
		height: node.sizePx,
	};
}
