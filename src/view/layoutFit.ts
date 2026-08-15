import type { FolderPath, GraphNode } from "../engine";
import type { Dimensions, XY } from "./flowMapping";
import type { FolderGroupingResult } from "./folderGrouping";
import { deriveFolderGroups } from "./folderGrouping";
import { folderGroupIdOf, nodeDimensionsPx } from "./graphIdentity";

/**
 * Does a resized node still FIT where the previous layout put it? (ticket
 * `nid_9ep12hkmk4zjv2p28emmrhieq_e`.)
 *
 * A committed drag-resize used to relayout unconditionally, which re-arranges —
 * and re-fits — the whole graph even when the new box had room to spare. That
 * is a jump the user did not ask for: they made ONE node bigger, everything
 * else was fine where it was. So the resize now asks a geometry question first,
 * and only a box that collides relayouts.
 *
 * Pure and node-testable; the structural diff is its only caller.
 *
 * ACCEPTED LIMITATION — a SHRINK leaves its folder-group box oversized (ticket
 * `nid_brzatca9hp65cg6w3s4xz27k6_e`, decided). A smaller box always fits, so a
 * shrink (drag inward, or "Reset size") always reuses the layout — and the
 * reuse path keeps the elk-computed `groupDimensions` as-is. A shrunken GROUP
 * MEMBER therefore sits in a folder rectangle still sized for its old, bigger
 * box, with visible dead space, until the next structural relayout re-runs elk.
 * WHY accepted: re-arranging the whole graph — every node jumping — is a worse
 * outcome than a temporarily roomy border, and the border self-corrects on the
 * next structural change. WHY-NOT shrink the group box in place here: its size
 * is elk's answer to the whole subtree's packing, not a max over member boxes,
 * so recomputing it in the view would be a second, diverging layout opinion.
 */

/**
 * The geometry a `reuse-layout` rebuild would keep: what
 * `GraphViewController` holds from the last elk pass. Positions are ABSOLUTE
 * top-left corners (`extractElkPositions` flattens elk's parent-relative
 * coordinates) and cover note nodes AND folder-group containers;
 * `groupDimensions` carries the elk-computed box of each container.
 */
export interface RenderedLayout {
	readonly positions: ReadonlyMap<string, XY>;
	readonly groupDimensions: ReadonlyMap<string, Dimensions>;
}

/** No layout rendered yet — every fit question answers "no" (nothing to reuse). */
export const NO_RENDERED_LAYOUT: RenderedLayout = {
	positions: new Map(),
	groupDimensions: new Map(),
};

/** An axis-aligned box in the layout's absolute coordinate space. */
interface Rect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/**
 * True when every node in `resizedPaths`, drawn at its EXISTING position with
 * its NEW box, still clears everything around it — no overlap with another
 * node or with a folder-group box it does not sit inside, and (when it is a
 * group member) no spilling outside its own group's border nor any ancestor
 * group's — those nesting boxes are containers to stay within, not colliders.
 *
 * Anchored at the existing position because the only resize grips are
 * right / bottom / bottom-right (see `NoteNode`): a resize grows a node's
 * box, never moves its origin, so the previous top-left is exactly where the
 * new box lands.
 *
 * Judged on the NEXT graph's boxes throughout — nothing but the resized nodes
 * changed size, so the neighbours' next box IS their current one.
 *
 * Conservative by construction: a missing position or group box (geometry this
 * rule cannot see) answers `false`, i.e. relayout. Callers must therefore treat
 * `false` as "cannot promise a fit", not as "definitely collides".
 *
 * WHY-NOT a required clearance between boxes: the layout's own spacing knobs
 * describe how elk SEEDS a graph, not a gap the view is entitled to enforce
 * afterwards, and inventing a second spacing number here would be a second
 * opinion on the same thing. Plain overlap is the honest question — a user who
 * drags to within a hair of a neighbour and dislikes it drags a little further.
 */
export function resizedNodesFitRenderedLayout(
	resizedPaths: ReadonlySet<string>,
	nodes: readonly GraphNode[],
	layout: RenderedLayout,
	maxGroupNestingDepth: number,
): boolean {
	// The SAME depth cap the rendered layout was built under (the caller only asks
	// this question when the cap did not change): a different cap would derive
	// groups the layout never placed and answer "relayout" for every resize.
	const grouping = deriveFolderGroups(nodes, maxGroupNestingDepth);
	const nodeRects = new Map<string, Rect>();
	for (const node of nodes) {
		const position = layout.positions.get(node.path);
		if (position === undefined) {
			return false;
		}
		nodeRects.set(node.path, { ...position, ...nodeDimensionsPx(node) });
	}
	const groupRects = new Map<FolderPath, Rect>();
	for (const group of grouping.groups) {
		const groupId = folderGroupIdOf(group.folder);
		const position = layout.positions.get(groupId);
		const dimensions = layout.groupDimensions.get(groupId);
		if (position === undefined || dimensions === undefined) {
			return false;
		}
		groupRects.set(group.folder, { ...position, ...dimensions });
	}
	for (const path of resizedPaths) {
		const rect = nodeRects.get(path);
		if (rect === undefined) {
			return false;
		}
		// Groups nest (folderGrouping, plan D2): the node's own group AND every
		// ancestor group are CONTAINERS the rect must stay inside, never colliders
		// — a nested member always sits inside each ancestor's box, so an overlap
		// test against them would answer "no fit" unconditionally (ticket
		// `nid_vjezt4ewmn50r0mbwjdfn70i2_e`).
		const containerFolders = containerGroupFoldersOf(grouping, path);
		for (const containerFolder of containerFolders) {
			if (!containsRect(groupRects.get(containerFolder), rect)) {
				return false;
			}
		}
		for (const [otherPath, otherRect] of nodeRects) {
			if (otherPath !== path && overlaps(rect, otherRect)) {
				return false;
			}
		}
		for (const [otherFolder, groupRect] of groupRects) {
			if (!containerFolders.has(otherFolder) && overlaps(rect, groupRect)) {
				return false;
			}
		}
	}
	return true;
}

/**
 * Folders of the groups CONTAINING a member node: its own group plus each
 * ancestor group, walking the rendered `parentFolder` chain. Empty for an
 * ungrouped node — every group box is then foreign to it.
 */
function containerGroupFoldersOf(grouping: FolderGroupingResult, memberPath: string): ReadonlySet<FolderPath> {
	const folders = new Set<FolderPath>();
	const ownFolder = grouping.groupFolderByMemberPath.get(memberPath);
	let group = ownFolder === undefined ? null : grouping.nearestRenderedAncestorGroupOf(ownFolder);
	while (group !== null) {
		folders.add(group.folder);
		group = group.parentFolder === null ? null : grouping.nearestRenderedAncestorGroupOf(group.parentFolder);
	}
	return folders;
}

/** Overlap = a positive-area intersection; boxes that merely touch are not overlapping. */
function overlaps(a: Rect, b: Rect): boolean {
	return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** `inner` sits fully within `outer` (edge-flush counts as inside). A missing `outer` contains nothing. */
function containsRect(outer: Rect | undefined, inner: Rect): boolean {
	if (outer === undefined) {
		return false;
	}
	return (
		inner.x >= outer.x &&
		inner.y >= outer.y &&
		inner.x + inner.width <= outer.x + outer.width &&
		inner.y + inner.height <= outer.y + outer.height
	);
}
