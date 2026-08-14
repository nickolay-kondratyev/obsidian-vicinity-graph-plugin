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
import { suppressedDuplicateThumbnails } from "./duplicateImageThumbnails";
import type { TraversedNode } from "./VicinityTraversal";
import type { VaultPath, ViewSettings } from "./types";

/**
 * The view knobs the content-fit estimate depends on — a projection of
 * {@link ViewSettings}, accepted whole so the facade passes one object.
 */
export type NodeSizingView = Pick<ViewSettings, "sizing" | "outlineMaxDepth" | "nodePreviewPreference">;

/** The resolved preview decision, carried between {@link NodeSizer}'s two sizing halves. */
interface ResolvedPreview {
	readonly kind: NodePreviewKind;
	/** Entries the outline would render (post depth-filter) — the outline region's height driver. */
	readonly renderableOutlineEntries: number;
}

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
 * IMAGE nodes (their preview slot resolves to the thumbnail) are floored at
 * `sizing.minImageHeightPx` instead of the bare `minPx`, so a picture is legible
 * even on a sparse note. Still capped by `maxPx` — it is a floor, not a bypass.
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
		const { minPx, maxPx, minImageHeightPx } = clampSizingSettings(rawView.sizing);
		const centralFloorPx = Math.round(minPx + CENTRAL_PROMINENCE_FLOOR_SCORE * (maxPx - minPx));
		// A node whose image the de-dup handed to another node (see
		// {@link suppressedDuplicateThumbnails}) must be sized for what it WILL show,
		// not the thumbnail it no longer paints — else it reserves the slot / image
		// floor for a picture that never appears (a large empty box, ticket
		// nid_psgov2t1d2s8d7rk2qvux02zb_e). The candidacy is judged on the GLOBAL
		// preference (the same basis this sizer reads throughout), so `sizePx` stays
		// independent of a per-node CONTENT flip: the VIEW's own de-dup, which honours
		// that override, drives the render and matches this size except where an
		// override is set — the same deliberate sizer/override divergence documented
		// on {@link resolvePreview}. De-dup over the SAME node set the caller passes
		// (the engine passes the VISIBLE, post-truncation nodes), so winner and losers
		// match the view's.
		const suppressedImagePaths = NodeSizer.suppressedThumbnails(nodes, rawView);
		const sizes = new Map<VaultPath, number>();
		for (const [path, node] of nodes) {
			const hasImage = node.firstImagePath !== undefined && !suppressedImagePaths.has(path);
			const preview = NodeSizer.resolvePreview(node, rawView, hasImage);
			const fit = NodeSizer.contentFitPx(node, preview);
			// An IMAGE node (its preview slot resolves to the thumbnail) is floored at
			// `minImageHeightPx` so a picture is legible even on an otherwise sparse
			// note — like every other floor, still bounded above by `maxPx`, so an
			// explicit `maxPx` below it wins (the node is then small AND the image
			// shrinks to fit). Text nodes keep the bare `minPx` floor.
			const floorPx = preview.kind === "thumbnail" ? Math.max(minPx, minImageHeightPx) : minPx;
			const clamped = Math.min(maxPx, Math.max(floorPx, fit));
			sizes.set(path, node.isCentral ? Math.max(clamped, centralFloorPx) : clamped);
		}
		return sizes;
	}

	/**
	 * Which region a node shows and how many outline entries it renders — the ONE
	 * {@link nodePreviewKind} decision the view mapping renders by, resolved here so
	 * {@link computeSizes} can both size the region and floor image nodes without
	 * assembling the same inputs twice.
	 *
	 * Decided from the RENDERABLE entry count (post depth-filter), the same
	 * zero-vs-some fact the view mapping decides with — the view's additional DOM cap
	 * cannot flip it (a capped non-empty outline stays non-empty).
	 */
	private static resolvePreview(
		node: TraversedNode,
		view: Pick<NodeSizingView, "outlineMaxDepth" | "nodePreviewPreference">,
		hasImage: boolean,
	): ResolvedPreview {
		const renderableOutlineEntries = node.outline.filter((entry) => entry.level <= view.outlineMaxDepth).length;
		const kind = nodePreviewKind({
			preference: view.nodePreviewPreference,
			outlineEntryCount: renderableOutlineEntries,
			hasImage,
			imagePrecedesOutline: node.imagePrecedesOutline,
			isCentral: node.isCentral,
		});
		return { kind, renderableOutlineEntries };
	}

	/**
	 * The paths whose first image the cross-node de-dup withholds — the losers of each
	 * duplicate-thumbnail group. Candidacy uses the GLOBAL-preference preview kind (the
	 * only basis this sizer knows), NEVER a per-node content override, so `sizePx`
	 * cannot move on a content flip. In the common case (no overrides) this is exactly
	 * the view's suppressed set, so the sized box matches the rendered region.
	 */
	private static suppressedThumbnails(
		nodes: ReadonlyMap<VaultPath, TraversedNode>,
		view: NodeSizingView,
	): ReadonlySet<string> {
		return suppressedDuplicateThumbnails(
			[...nodes.values()].map((node) => ({
				path: node.path,
				folder: node.folder,
				firstImagePath: node.firstImagePath,
				rendersThumbnail: NodeSizer.resolvePreview(node, view, node.firstImagePath !== undefined).kind === "thumbnail",
			})),
		);
	}

	/**
	 * Border-box height (px) the node's rendered regions need, BEFORE the
	 * minPx/maxPx clamp. An estimate of `graph-view.css` (see the estimate
	 * constants' WHY in `constants.ts`) — the CSS flexes real content into
	 * whatever box this steers the layout to.
	 */
	private static contentFitPx(node: TraversedNode, preview: ResolvedPreview): number {
		const titleClamp = preview.kind === "thumbnail" ? THUMBNAIL_PREVIEW_TITLE_LINE_CLAMP : NODE_TITLE_LINE_CLAMP;
		const regions: number[] = [NodeSizer.titleLines(node.title, titleClamp) * ESTIMATED_TITLE_LINE_PX];
		if (preview.kind === "outline") {
			regions.push(preview.renderableOutlineEntries * ESTIMATED_OUTLINE_ENTRY_PX);
		} else if (preview.kind === "thumbnail") {
			regions.push(ESTIMATED_THUMBNAIL_SLOT_PX);
		}
		const hasAttachments = node.attachments.length > 0;
		if (hasAttachments) {
			regions.push(ESTIMATED_ATTACHMENT_ROW_PX);
		}
		const chromePx = nodeVerticalChromePx(node.isCentral);
		const fit = chromePx + regions.reduce((sum, px) => sum + px, 0) + (regions.length - 1) * NODE_REGION_GAP_PX;
		return Math.max(fit, NodeSizer.revealFloorPx(preview.kind, hasAttachments, node.isCentral));
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
