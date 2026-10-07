import { FileKinds } from "../shared/FileKinds";
import { MarkdownInlineLinks } from "../shared/MarkdownInlineLinks";
import { Wikilinks } from "../shared/Wikilinks";
import type { RelationshipEdge, RelationshipSources } from "./EdgeRelationships";
import type { DirectedLink, VaultPath } from "./types";
import { directedLinkKey } from "./types";

/**
 * Which edges auto mode may ask the AI to name (task 3/4
 * `nid_cbnhpdfn4myqfzqr8weyg7kq5_e`, human decisions in epic
 * `nid_fc47gtxej6z7fqc53bflme8p5_e` "AI mode"). Pure, and split in TWO phases on
 * purpose: {@link aiEdgeEligibility} needs only what a build already holds, so
 * the caller reads note TEXT (async I/O) only for the edges that pass it, and
 * {@link hasEnoughAiContent} judges that text.
 */

/**
 * Least prose BOTH notes must hold for a name to be worth a request (human
 * decision 2026-10-06): below this a note is mostly a link or a stub, and the
 * model can only guess.
 */
export const MIN_AI_CONTENT_CHARS = 200;

/** Why an edge is not an AI candidate; `candidate` = ask once both notes' text is read. */
export type AiEdgeEligibility =
	/** Passes every check that needs no note text. */
	| "candidate"
	/** Something already names exactly this direction: syntax, manual, AI, or a dismissed AI name. */
	| "already-named"
	/**
	 * The source's own syntax names could not be read this build (its link cache lags
	 * an edit), so whether it names this link is unknown — never guessed as unnamed.
	 */
	| "syntax-unread"
	/** A pure folder-hierarchy edge — it already reads `parent`. */
	| "folder-hierarchy"
	/** An endpoint renders inside a folder group (human decision: a waste for now; revisit later). */
	| "grouped-note"
	/** An endpoint is neither a note (`.md`) nor a canvas — there is no prose to read. */
	| "unsupported-file";

/** What a build knows that eligibility reads. */
export interface AiEligibilityFacts {
	/** The names this build resolved from — `stored` includes dismissed (`name: null`) entries. */
	readonly sources: RelationshipSources;
	/** Every note path rendered inside a folder group in the current graph. */
	readonly groupedPaths: ReadonlySet<VaultPath>;
	/** Sources whose syntax names this build could not read (`SyntaxRelationshipRead.unreadSources`). */
	readonly syntaxUnreadSources: ReadonlySet<VaultPath>;
}

/**
 * The text-free checks, for the DIRECTED edge `source → target`. A name for the
 * reverse direction does NOT block it: relationships are directed, and
 * `B —improves→ A` says nothing about `A → B`.
 */
export function aiEdgeEligibility(edge: RelationshipEdge, facts: AiEligibilityFacts): AiEdgeEligibility {
	if (edge.hierarchy && edge.count === 0) {
		return "folder-hierarchy";
	}
	if (!FileKinds.isNodeBearingPath(edge.source) || !FileKinds.isNodeBearingPath(edge.target)) {
		return "unsupported-file";
	}
	if (facts.groupedPaths.has(edge.source) || facts.groupedPaths.has(edge.target)) {
		return "grouped-note";
	}
	const key = directedLinkKey(edge.source, edge.target);
	if (facts.sources.syntax.has(key) || facts.sources.stored.has(key)) {
		return "already-named";
	}
	if (facts.syntaxUnreadSources.has(edge.source)) {
		return "syntax-unread";
	}
	return "candidate";
}

/** The edges of a build that pass {@link aiEdgeEligibility}, in build order — what the AI queue is handed. */
export function aiCandidateEdges(edges: readonly RelationshipEdge[], facts: AiEligibilityFacts): readonly DirectedLink[] {
	return edges
		.filter((edge) => aiEdgeEligibility(edge, facts) === "candidate")
		.map((edge) => ({ source: edge.source, target: edge.target }));
}

/**
 * A leading YAML frontmatter block: `---` on the first line through the next
 * line that is exactly `---` (non-greedy), plus its line ending.
 */
const FRONTMATTER_BLOCK = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const WHITESPACE = /\s+/g;

/**
 * How much of `text` is the note's OWN prose: frontmatter, link syntax (wikilinks,
 * embeds and markdown links, label included — a note that is only links has
 * nothing to say) and all whitespace removed.
 */
export function aiContentChars(text: string): number {
	return text
		.replace(FRONTMATTER_BLOCK, "")
		.replace(Wikilinks.globalPattern(), "")
		.replace(MarkdownInlineLinks.globalPattern(), "")
		.replace(WHITESPACE, "").length;
}

/** The content half of eligibility: does this note hold at least {@link MIN_AI_CONTENT_CHARS} of prose? */
export function hasEnoughAiContent(text: string): boolean {
	return aiContentChars(text) >= MIN_AI_CONTENT_CHARS;
}
