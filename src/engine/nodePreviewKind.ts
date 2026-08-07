import type { NodePreviewPreference } from "./types";

/**
 * Which preview region a note node renders. At most ONE — the leading video, the
 * outline and the thumbnail all share the same slot, so the choice is made once,
 * here, rather than re-derived by each JSX branch (which is how a node with no
 * thumbnail ended up advertising `data-preview="thumbnail"`).
 */
export type NodePreviewKind = "video" | "outline" | "thumbnail" | "none";

export interface NodePreviewInput {
	/** The user's resolved `ViewSettings.nodePreviewPreference`. */
	readonly preference: NodePreviewPreference;
	/** Entries that will actually RENDER (post depth-filter, post render budget). */
	readonly outlineEntryCount: number;
	readonly hasImage: boolean;
	/** The adapter's document-position fact (`GraphNode.imagePrecedesOutline`). */
	readonly imagePrecedesOutline: boolean;
	/**
	 * `TraversedNode.isCentral` — true for MAIN and every pinned root. Under Auto
	 * this is the tier line: only a root is offered the outline (see below).
	 */
	readonly isCentral: boolean;
	/**
	 * The adapter reported a LEADING external YouTube hero for this note
	 * (`GraphNode.leadingVideo !== undefined`). A candidate only — {@link externalPreviews}
	 * decides whether it is ELIGIBLE for the slot.
	 */
	readonly hasLeadingVideo: boolean;
	/**
	 * `ViewSettings.externalPreviews` — the global privacy switch. When OFF the
	 * leading video is NOT eligible as the hero: the note falls through to the
	 * ordinary thumbnail/outline ladder exactly as if it carried no video (the
	 * render ticket's OFF requirement, decided at hero SELECTION, not the renderer).
	 */
	readonly externalPreviews: boolean;
}

/**
 * THE one place the outline-vs-image precedence lives. The adapter reports facts
 * and pre-decides nothing, so a node offering both regions is resolved here.
 *
 * Engine-owned (moved from the view) because TWO consumers must agree on it:
 * the view mapping (which region renders) and the content-fit `NodeSizer`
 * (how tall the node must be for that region). A view-local copy would let the
 * sizer reserve space for a region the node never shows.
 */
export function nodePreviewKind({
	preference,
	outlineEntryCount,
	hasImage,
	imagePrecedesOutline,
	isCentral,
	hasLeadingVideo,
	externalPreviews,
}: NodePreviewInput): NodePreviewKind {
	// The ONE preference that deliberately empties the content slot: no video, no
	// outline, no thumbnail, just the title — regardless of what the note has.
	// Every OTHER preference only ever withholds the kind the note has an
	// alternative of (it never blanks a node), so this is the single early-out
	// before that rule — and, by sitting ABOVE the video branch, it stays the one
	// documented preference that empties even a leading video's slot.
	if (preference === "title-only") {
		return "none";
	}
	// The leading external video is the EXCLUSIVE winner of the preview slot when
	// eligible (owner decision option A, 2026-08-07): resolved AHEAD of the whole
	// thumbnail/outline ladder, and never overridden by an image/outline preference
	// — a leading hero is the note's headline. Its ONE gate is the privacy switch:
	// with external previews OFF the video is not eligible, and the note falls
	// through to the ordinary ladder below exactly as if it carried no video (so an
	// OFF setting relayouts to today's thumbnail/outline hero, never a blank slot).
	if (externalPreviews && hasLeadingVideo) {
		return "video";
	}
	// Under Auto the outline is a ROOT's affordance, not every neighbour's (owner
	// decision 2026-08-05, nid_k2pa8khm6ugozmhkd6nlbdrq6_e): with content-fit
	// sizing, any note with ONE heading floors at the CSS reveal rung, so letting
	// the whole vicinity claim the preview slot turns the graph into a wall of
	// near-identical big boxes. An ordinary neighbour's Auto ladder is therefore
	// image → title only; an EXPLICIT preference (or, later, a per-node override)
	// still reaches the outline anywhere.
	const outlineOffered = outlineEntryCount > 0 && (preference !== "auto" || isCentral);
	// Two ways to land here, one answer: the note has no renderable outline, or
	// Auto withheld it. Either way the image is the only candidate left — which is
	// also why an EXPLICIT preference is a PREFERENCE and never a blank node (it
	// only ever withholds the kind the note DOES have another of), so the branches
	// below never restate the fallback.
	if (!outlineOffered) {
		return hasImage ? "thumbnail" : "none";
	}
	if (!hasImage) {
		return "outline";
	}
	switch (preference) {
		case "outline":
			return "outline";
		case "image":
			return "thumbnail";
		case "auto":
			// The documented escape hatch, unchanged: the image wins iff it sits
			// above the first heading (the adapter reports that fact).
			return imagePrecedesOutline ? "thumbnail" : "outline";
	}
}
