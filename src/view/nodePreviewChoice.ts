/**
 * Which preview region a note node renders. At most ONE — the outline and the
 * thumbnail share the same slot, so the choice is made once, here, rather than
 * re-derived by each JSX branch (which is how a node with no thumbnail ended up
 * advertising `data-preview="thumbnail"`).
 */
export type NodePreviewKind = "outline" | "thumbnail" | "none";

export interface NodePreviewInput {
	/** Entries that will actually RENDER (post depth-filter, post render budget). */
	readonly outlineEntryCount: number;
	readonly hasImage: boolean;
	/** The adapter's document-position fact (`GraphNode.imagePrecedesOutline`). */
	readonly imagePrecedesOutline: boolean;
}

/**
 * THE one place the outline-vs-image precedence lives. The adapter reports facts
 * and pre-decides nothing, so a node offering both regions is resolved here.
 */
export function nodePreviewKind({
	outlineEntryCount,
	hasImage,
	imagePrecedesOutline,
}: NodePreviewInput): NodePreviewKind {
	// A node is never made emptier than the facts allow: when only one side
	// exists it wins outright, so the choice below never restates the fallback.
	if (outlineEntryCount === 0) {
		return hasImage ? "thumbnail" : "none";
	}
	if (!hasImage) {
		return "outline";
	}
	// The documented escape hatch: the image wins iff it sits above the first
	// heading — "show the picture instead" for cover-image notes.
	return imagePrecedesOutline ? "thumbnail" : "outline";
}
