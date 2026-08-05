import type { NodePreviewPreference } from "./types";

/**
 * Which preview region a note node renders. At most ONE — the outline and the
 * thumbnail share the same slot, so the choice is made once, here, rather than
 * re-derived by each JSX branch (which is how a node with no thumbnail ended up
 * advertising `data-preview="thumbnail"`).
 */
export type NodePreviewKind = "outline" | "thumbnail" | "none";

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
}: NodePreviewInput): NodePreviewKind {
	// Under Auto the outline is a ROOT's affordance, not every neighbour's (owner
	// decision 2026-08-05, nid_k2pa8khm6ugozmhkd6nlbdrq6_e): with content-fit
	// sizing, any note with ONE heading floors at the CSS reveal rung, so letting
	// the whole vicinity claim the preview slot turns the graph into a wall of
	// near-identical big boxes. An ordinary neighbour's Auto ladder is therefore
	// image → title only; an EXPLICIT preference (or, later, a per-node override)
	// still reaches the outline anywhere.
	const outlineOffered = outlineEntryCount > 0 && (preference !== "auto" || isCentral);
	// A preference is a PREFERENCE, never a blank node: when only one side exists
	// it wins outright, so the branches below never restate the fallback.
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
