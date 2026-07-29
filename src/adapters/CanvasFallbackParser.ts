import { MarkdownCodeRegions } from "../shared/MarkdownCodeRegions";
import { MarkdownInlineLinks } from "../shared/MarkdownInlineLinks";
import { Wikilinks } from "../shared/Wikilinks";

/**
 * Fallback `.canvas` JSON parser — the ACTIVE link source for each canvas that
 * `metadataCache.resolvedLinks` does not index (verified on the target install,
 * see step-03 CLARIFICATION Q2). `CanvasCapability` decides that PER CANVAS, so
 * this parser can be dormant for one canvas and serving another in the same
 * vault; core-indexed canvases never reach it.
 *
 * Scope: FILE-type nodes AND the links written inside TEXT-type node bodies
 * (wikilinks and markdown-style inline links alike — a text node is markdown),
 * because those two together are what Obsidian's own indexer reports
 * for a canvas — the two regimes must yield the same edge set or the boot race
 * over which one runs becomes user-visible (ticket
 * `nid_s676x55uojmtcwh9t4l9mc6zl_e`). `link`-type (external URL) and `group`
 * nodes reference no vault document and yield nothing.
 *
 * PARSING ONLY: the two node kinds speak different languages — a file node
 * carries a literal vault PATH, a text node carries LINK TEXT needing
 * Obsidian's resolution — so both travel out as {@link CanvasReference}s and
 * the caller (which owns the metadata cache) resolves them. Malformed JSON
 * NEVER throws (matches obsidian-id-lib's philosophy): it logs `console.error`
 * and yields no links.
 */
export class CanvasFallbackParser {
	/**
	 * Everything the canvas references, in node-array order (the canvas's notion
	 * of reference order) and, within a text node, in written order. May contain
	 * duplicates and references that resolve to nothing — callers resolve and
	 * dedupe.
	 */
	static parseReferences(canvasPath: string, rawJson: string): readonly CanvasReference[] {
		let parsed: unknown;
		try {
			parsed = JSON.parse(rawJson);
		} catch {
			console.error(`vicinity-graph: malformed canvas JSON, skipping links of [${canvasPath}]`);
			return [];
		}
		return CanvasFallbackParser.referencesOf(parsed);
	}

	private static referencesOf(parsed: unknown): readonly CanvasReference[] {
		if (typeof parsed !== "object" || parsed === null) {
			return [];
		}
		const nodes = (parsed as { nodes?: unknown }).nodes;
		if (!Array.isArray(nodes)) {
			return [];
		}
		const references: CanvasReference[] = [];
		for (const node of nodes) {
			references.push(...CanvasFallbackParser.referencesOfNode(node));
		}
		return references;
	}

	/**
	 * A file node yields exactly one reference, a text node zero-or-many, and
	 * every other node kind (link/group/garbage) none.
	 */
	private static referencesOfNode(node: unknown): readonly CanvasReference[] {
		if (typeof node !== "object" || node === null) {
			return [];
		}
		const { type, file, text } = node as { type?: unknown; file?: unknown; text?: unknown };
		if (type === "file") {
			return typeof file === "string" && file.length > 0 ? [{ kind: "file-node", filePath: file }] : [];
		}
		if (type === "text" && typeof text === "string") {
			return CanvasFallbackParser.textNodeReferencesOf(text);
		}
		return [];
	}

	/**
	 * BOTH link syntaxes a markdown body can carry — wikilinks and markdown-style
	 * inline links — because a canvas text node IS markdown and core indexes both
	 * (ticket `nid_ygo7h95ssgmunaqsprc1zlmfh_e`). One reference kind for the two,
	 * since both come out as link TEXT resolved the same way.
	 *
	 * Two scans, so the result is "wikilinks, then inline links" rather than
	 * strictly written order. Deliberate: edge ORDER is not contractual on either
	 * regime, while the edge SET and the per-target COUNT — which is all the
	 * caller derives — are order-insensitive.
	 *
	 * Both scans read PROSE only: code spans and fenced blocks are masked first,
	 * because core indexes no link written inside them (measured by
	 * `e2e/canvasMarkdownLinkIndexing.e2e.ts`) and harvesting one here would be a
	 * phantom edge that appears only when the boot race lands on this regime
	 * (ticket `nid_869bt9d9rlrbr8of1403dnmf3_e`).
	 */
	private static textNodeReferencesOf(text: string): readonly CanvasReference[] {
		const prose = MarkdownCodeRegions.withCodeMasked(text);
		return [...Wikilinks.linkTargetsOf(prose), ...MarkdownInlineLinks.linkTargetsOf(prose)].map(
			(linkText) => ({ kind: "text-node-link", linkText }) as const,
		);
	}
}

/**
 * One thing a canvas points at, tagged with HOW it must be resolved — a literal
 * vault path (file node) or Obsidian link text (a text-node wikilink or
 * markdown-style inline link, both normalised to link text). The tag is
 * the whole point: resolving link text as a path, or vice versa, silently loses
 * edges.
 */
export type CanvasReference =
	| { readonly kind: "file-node"; readonly filePath: string }
	| { readonly kind: "text-node-link"; readonly linkText: string };
