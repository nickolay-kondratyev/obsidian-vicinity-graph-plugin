/**
 * Which preview region a note node renders. At most ONE — the outline and the
 * thumbnail share the same slot, so the choice is made once, here, rather than
 * re-derived by each JSX branch (which is how a node with no thumbnail ended up
 * advertising `data-preview="thumbnail"`).
 */
export type NodePreviewKind = "outline" | "thumbnail" | "none";

export interface NodePreviewInput {
	readonly outlineEntryCount: number;
	readonly hasImage: boolean;
}

/**
 * The outline wins when it has entries — the ADAPTER already applied the
 * image-vs-outline rule (an image before the first heading yields no entries at
 * all), so entries reaching the view mean the outline won. Otherwise the image,
 * if any; otherwise the node is title-only.
 */
export function nodePreviewKind({ outlineEntryCount, hasImage }: NodePreviewInput): NodePreviewKind {
	if (outlineEntryCount > 0) {
		return "outline";
	}
	return hasImage ? "thumbnail" : "none";
}
