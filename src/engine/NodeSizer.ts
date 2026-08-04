import {
	CENTRAL_PROMINENCE_FLOOR_SCORE,
	ESTIMATED_ATTACHMENT_ROW_PX,
	ESTIMATED_OUTLINE_ENTRY_PX,
	ESTIMATED_TITLE_LINE_PX,
	NODE_LABEL_HORIZONTAL_PADDING_PX,
	NODE_MAX_LABEL_WIDTH_PX,
	NODE_REGION_GAP_PX,
	NODE_TITLE_LINE_CLAMP,
	NODE_VERTICAL_CHROME_PX,
	THUMBNAIL_VISIBLE_MIN_NODE_PX,
	clampSizingSettings,
	estimateNodeLabelWidthPx,
} from "./constants";
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
 *   the attachment-chip row.
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
		const regions: number[] = [NodeSizer.titleLines(node.title) * ESTIMATED_TITLE_LINE_PX];
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
		if (preview === "outline") {
			regions.push(renderableOutlineEntries * ESTIMATED_OUTLINE_ENTRY_PX);
		}
		if (node.attachments.length > 0) {
			regions.push(ESTIMATED_ATTACHMENT_ROW_PX);
		}
		const fit =
			NODE_VERTICAL_CHROME_PX + regions.reduce((sum, px) => sum + px, 0) + (regions.length - 1) * NODE_REGION_GAP_PX;
		if (preview === "thumbnail") {
			// The thumbnail region is not summed like the others: the CSS reveals it
			// only at the container-query threshold, so "fits its thumbnail" IS that
			// threshold — anything between fit-with-slot and the reveal would reserve
			// space for an image the node then hides.
			return Math.max(fit, THUMBNAIL_VISIBLE_MIN_NODE_PX);
		}
		return fit;
	}

	/**
	 * Lines the title wraps onto at the label-width cap, clamped by the CSS
	 * line clamp — the height counterpart of the view's snug width estimate.
	 */
	private static titleLines(title: string): number {
		const textWidthPx = estimateNodeLabelWidthPx(title) - NODE_LABEL_HORIZONTAL_PADDING_PX;
		const lineWidthPx = NODE_MAX_LABEL_WIDTH_PX - NODE_LABEL_HORIZONTAL_PADDING_PX;
		return Math.min(NODE_TITLE_LINE_CLAMP, Math.max(1, Math.ceil(textWidthPx / lineWidthPx)));
	}
}
