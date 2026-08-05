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
}: NodePreviewInput): NodePreviewKind {
	// A preference is a PREFERENCE, never a blank node: when only one side exists
	// it wins outright, so the branches below never restate the fallback.
	if (outlineEntryCount === 0) {
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
