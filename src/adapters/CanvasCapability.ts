/**
 * Whether this install's `metadataCache.resolvedLinks` indexes `.canvas`
 * files as link sources (core behavior from Obsidian 1.12.4 on — but NOT
 * observed on the target install, see step-03 CLARIFICATION Q2).
 */
export type CanvasCapability = "core-indexed" | "fallback-required";

const CANVAS_KEY_SUFFIX = ".canvas";

/**
 * Build-time detection (step doc): any `.canvas` key among the resolvedLinks
 * sources ⇒ canvas links already flow through the normal path and the
 * fallback parser must stay dormant (it would double-report links).
 *
 * Known caveat (accepted in CLARIFICATION Q2): a vault with zero canvas files
 * also reports "fallback-required" — harmless, the fallback then has nothing
 * to parse.
 */
export class CanvasCapabilityDetector {
	static detect(resolvedLinkSourcePaths: Iterable<string>): CanvasCapability {
		for (const sourcePath of resolvedLinkSourcePaths) {
			if (sourcePath.endsWith(CANVAS_KEY_SUFFIX)) {
				return "core-indexed";
			}
		}
		return "fallback-required";
	}
}
