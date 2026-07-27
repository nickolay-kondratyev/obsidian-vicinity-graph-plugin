/**
 * Where ONE canvas's links come from: Obsidian's own `metadataCache.resolvedLinks`
 * (core behavior from Obsidian 1.12.4 on — but NOT observed on the target install,
 * see step-03 CLARIFICATION Q2), or our fallback parser.
 */
export type CanvasCapability = "core-indexed" | "fallback-required";

/**
 * PER CANVAS, never per install (ticket `nid_s676x55uojmtcwh9t4l9mc6zl_e`): Obsidian
 * indexes canvases one file at a time, and a canvas its boot sweep missed can stay
 * unindexed indefinitely (measured while building the e2e harness: indexed in 4 of 8
 * launches, and never later in the misses). A vault-wide answer is therefore not
 * merely imprecise, it is WRONG for the canvases on the other side of a partial
 * index — it would leave them with no link source at all.
 *
 * The test is the PRESENCE of the canvas's own key, not its contents: an indexed
 * canvas that genuinely has no links appears as `{}`, and that empty answer is core's
 * answer, which we respect instead of second-guessing it with our parser. Presence is
 * also an exact key lookup, so a note named `my.canvas.md` can no longer be mistaken
 * for a canvas the way a suffix scan could.
 */
export class CanvasCapabilityDetector {
	static detectFor(resolvedLinks: Readonly<Record<string, unknown>>, canvasPath: string): CanvasCapability {
		return resolvedLinks[canvasPath] === undefined ? "fallback-required" : "core-indexed";
	}
}
