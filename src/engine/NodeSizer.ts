import {
	ATTACHMENT_ROW_REVEAL_CONTENT_BOX_PX,
	CENTRAL_PROMINENCE_FLOOR_SCORE,
	ESTIMATED_ATTACHMENT_ROW_PX,
	ESTIMATED_OUTLINE_ENTRY_PX,
	ESTIMATED_THUMBNAIL_SLOT_PX,
	ESTIMATED_TITLE_LINE_PX,
	NODE_LABEL_HORIZONTAL_PADDING_PX,
	NODE_MAX_LABEL_WIDTH_PX,
	NODE_REGION_GAP_PX,
	NODE_TITLE_LINE_CLAMP,
	PREVIEW_SLOT_REVEAL_CONTENT_BOX_PX,
	THUMBNAIL_PREVIEW_TITLE_LINE_CLAMP,
	clampSizingSettings,
	estimateNodeLabelWidthPx,
	nodeVerticalChromePx,
	revealMinNodePx,
} from "./constants";
import type { NodePreviewKind } from "./nodePreviewKind";
import { nodePreviewKind } from "./nodePreviewKind";
import type { TraversedNode } from "./VicinityTraversal";
import type { VaultPath, ViewSettings } from "./types";

/**
 * The view knobs the content-fit estimate depends on — a projection of
 * {@link ViewSettings}, accepted whole so the facade passes one object.
 */
export type NodeSizingView = Pick<ViewSettings, "sizing" | "outlineMaxDepth" | "nodePreviewPreference">;

/**
 * Sizes every node to FIT the content it will actually show (node-sizing
 * rethink Q1, decided 2026-08-03 — the metric dials are gone):
 *
 *   `sizePx = clamp(contentFitPx, minPx, maxPx)`, where `contentFitPx` counts
 *   the title lines, the renderable outline entries or the thumbnail slot, and
 *   the attachment-chip row — then floors that sum at the CSS density rung the
 *   counted regions are REVEALED at (see {@link NodeSizer.revealFloorPx}), so
 *   the box never reserves space for a region the stylesheet hides.
 *
 * Centrals (MAIN + pinned — even when disconnected from MAIN) are additionally
 * FLOORED at {@link CENTRAL_PROMINENCE_FLOOR_SCORE} of the `minPx..maxPx` ramp
 * (Q2): an empty central no longer renders at maxPx, and a content-rich one
 * grows past the floor like any other node.
 *
 * WHY the region shown is decided HERE and not left to the view: size now
 * legitimately follows displayed content (the old preference-independence rule
 * is superseded by design — a preview-preference flip may relayout), so the
 * sizer resolves the SAME {@link nodePreviewKind} decision the view mapping
 * renders by.
 *
 * NOTE per-node CONTENT overrides (`NodeOverride.content`) are not consulted
 * yet: the view mapping does not apply them either, and the two must start in
 * the same ticket (`nid_9hx6okamx3yt0rg9iad2f4151_e`) or the box and the
 * rendered region would disagree.
 */
export class NodeSizer {
	static computeSizes(
		nodes: ReadonlyMap<VaultPath, TraversedNode>,
		rawView: NodeSizingView,
	): ReadonlyMap<VaultPath, number> {
		// The sizer is TOTAL: `sizePx` becomes node geometry a downstream wasm
		// router cannot survive being handed non-finite, so hostile settings are
		// clamped here with the SAME single-source table the settings boundary
		// uses — never with a bespoke guard that could drift from it.
		const { minPx, maxPx } = clampSizingSettings(rawView.sizing);
		const centralFloorPx = Math.round(minPx + CENTRAL_PROMINENCE_FLOOR_SCORE * (maxPx - minPx));
		const sizes = new Map<VaultPath, number>();
		for (const [path, node] of nodes) {
			const fit = NodeSizer.contentFitPx(node, rawView);
			const clamped = Math.min(maxPx, Math.max(minPx, fit));
			sizes.set(path, node.isCentral ? Math.max(clamped, centralFloorPx) : clamped);
		}
		return sizes;
	}

	/**
	 * Border-box height (px) the node's rendered regions need, BEFORE the
	 * minPx/maxPx clamp. An estimate of `graph-view.css` (see the estimate
	 * constants' WHY in `constants.ts`) — the CSS flexes real content into
	 * whatever box this steers the layout to.
	 */
	static contentFitPx(node: TraversedNode, view: Pick<NodeSizingView, "outlineMaxDepth" | "nodePreviewPreference">): number {
		// Decided from the RENDERABLE entry count (post depth-filter), the same
		// zero-vs-some fact the view mapping decides with — the view's additional
		// DOM cap cannot flip it (a capped non-empty outline stays non-empty).
		const renderableOutlineEntries = node.outline.filter((entry) => entry.level <= view.outlineMaxDepth).length;
		const preview = nodePreviewKind({
			preference: view.nodePreviewPreference,
			outlineEntryCount: renderableOutlineEntries,
			hasImage: node.firstImagePath !== undefined,
			imagePrecedesOutline: node.imagePrecedesOutline,
		});
		const titleClamp = preview === "thumbnail" ? THUMBNAIL_PREVIEW_TITLE_LINE_CLAMP : NODE_TITLE_LINE_CLAMP;
		const regions: number[] = [NodeSizer.titleLines(node.title, titleClamp) * ESTIMATED_TITLE_LINE_PX];
		if (preview === "outline") {
			regions.push(renderableOutlineEntries * ESTIMATED_OUTLINE_ENTRY_PX);
		} else if (preview === "thumbnail") {
			regions.push(ESTIMATED_THUMBNAIL_SLOT_PX);
		}
		const hasAttachments = node.attachments.length > 0;
		if (hasAttachments) {
			regions.push(ESTIMATED_ATTACHMENT_ROW_PX);
		}
		const chromePx = nodeVerticalChromePx(node.isCentral);
		const fit = chromePx + regions.reduce((sum, px) => sum + px, 0) + (regions.length - 1) * NODE_REGION_GAP_PX;
		return Math.max(fit, NodeSizer.revealFloorPx(preview, hasAttachments, node.isCentral));
	}

	/**
	 * The height a node must reach before `graph-view.css` PAINTS the regions
	 * counted above — its rung of the stylesheet's density ladder.
	 *
	 * WHY a floor and not just the summed regions: the reveals are container
	 * queries, so "fits its outline" IS the threshold. A node sized to the bare
	 * sum of a two-entry outline (75px) sits below the 122px reveal and renders
	 * as a title with 40px of dead space and NO outline — the same trap the
	 * thumbnail floor has always existed to avoid, which the outline and the chip
	 * row share because they share the ladder.
	 *
	 * WHY-NOT drop the hidden region from the sum instead (leaving the node
	 * small): then a note with two headings could never show them at any dial
	 * setting, and the preview kind the view renders by would name a region that
	 * never paints. The size dials remain the user's say — `computeSizes` clamps
	 * this floor into `minPx..maxPx`, so an explicit `maxPx` below a threshold
	 * still wins (the node is then small AND hides the region, which is what was
	 * asked for).
	 *
	 * Per-TIER, because the query reads the CONTENT box: a central's 2px accent
	 * border makes its content box 2px shorter at the same `sizePx`, and a floor
	 * that ignored that would miss the reveal by exactly those 2px — see
	 * `CENTRAL_NODE_VERTICAL_CHROME_PX` in `constants.ts`.
	 */
	private static revealFloorPx(preview: NodePreviewKind, hasAttachments: boolean, isCentral: boolean): number {
		return Math.max(
			preview === "none" ? 0 : revealMinNodePx(PREVIEW_SLOT_REVEAL_CONTENT_BOX_PX, isCentral),
			hasAttachments ? revealMinNodePx(ATTACHMENT_ROW_REVEAL_CONTENT_BOX_PX, isCentral) : 0,
		);
	}

	/**
	 * Lines the title wraps onto at the label-width cap, clamped by the CSS line
	 * clamp in force for this node's preview — the height counterpart of the
	 * view's snug width estimate.
	 */
	private static titleLines(title: string, lineClamp: number): number {
		const textWidthPx = estimateNodeLabelWidthPx(title) - NODE_LABEL_HORIZONTAL_PADDING_PX;
		const lineWidthPx = NODE_MAX_LABEL_WIDTH_PX - NODE_LABEL_HORIZONTAL_PADDING_PX;
		return Math.min(lineClamp, Math.max(1, Math.ceil(textWidthPx / lineWidthPx)));
	}
}
