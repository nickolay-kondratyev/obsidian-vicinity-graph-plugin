/**
 * Fallback `.canvas` JSON parser — the ACTIVE canvas link source on installs
 * whose `metadataCache.resolvedLinks` does not index canvas files (verified on
 * the target install, see step-03 CLARIFICATION Q2). When the install DOES
 * index canvas, `CanvasCapability` keeps this parser dormant.
 *
 * V1 scope (step doc): file-type nodes only. Wikilinks inside text nodes are
 * deliberately skipped. Malformed JSON NEVER throws (matches obsidian-id-lib's
 * philosophy): it logs `console.error` and yields no links.
 */
export class CanvasFallbackParser {
	/**
	 * Vault paths referenced by the canvas's file-type nodes, in node-array
	 * order (the canvas's notion of reference order). May contain duplicates
	 * and unresolved paths — callers resolve and dedupe.
	 */
	static parseFilePaths(canvasPath: string, rawJson: string): readonly string[] {
		let parsed: unknown;
		try {
			parsed = JSON.parse(rawJson);
		} catch {
			console.error(`neighborhood-graph: malformed canvas JSON, skipping links of [${canvasPath}]`);
			return [];
		}
		return CanvasFallbackParser.filePathsOf(parsed);
	}

	private static filePathsOf(parsed: unknown): readonly string[] {
		if (typeof parsed !== "object" || parsed === null) {
			return [];
		}
		const nodes = (parsed as { nodes?: unknown }).nodes;
		if (!Array.isArray(nodes)) {
			return [];
		}
		const paths: string[] = [];
		for (const node of nodes) {
			const path = CanvasFallbackParser.filePathOfNode(node);
			if (path !== null) {
				paths.push(path);
			}
		}
		return paths;
	}

	/** A file-type node with a string `file`; anything else (text/link/group/garbage) is null. */
	private static filePathOfNode(node: unknown): string | null {
		if (typeof node !== "object" || node === null) {
			return null;
		}
		const { type, file } = node as { type?: unknown; file?: unknown };
		if (type !== "file" || typeof file !== "string" || file.length === 0) {
			return null;
		}
		return file;
	}
}
