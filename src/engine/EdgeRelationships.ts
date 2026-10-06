import type { DirectedLink, GraphEdge, VaultPath } from "./types";
import { directedLinkKey } from "./types";

/**
 * Named relationships on graph edges (epic `nid_fc47gtxej6z7fqc53bflme8p5_e`,
 * task 1/4 `nid_gk9h4jpa7di1al7och0rehd3h_e`): which NAME a rendered edge
 * carries, and where it came from. Pure — the names a note declares arrive as
 * data ({@link SyntaxRelationshipNames}, read by an adapter), never as file text.
 *
 * A relationship is DIRECTED: a name for `B → A` never labels `A → B`. The one
 * cross-direction rule is the folder-hierarchy default, which a name in EITHER
 * direction hides (see {@link resolveEdgeRelationship}).
 */

/** The code default name of a pure folder-hierarchy edge (folder note → child). Computed, never stored. */
export const PARENT_RELATIONSHIP_NAME = "parent";

/** Joins the several names one note gives the same link, in note order. */
const SYNTAX_NAME_SEPARATOR = ", ";

/**
 * Where a resolved name came from. `syntax` = an inline field in the SOURCE note
 * (`rel:: [[target]]`); `folder-hierarchy` = the {@link PARENT_RELATIONSHIP_NAME}
 * default. Tasks 2-3 add `manual` and `ai` between the two.
 */
export type RelationshipOrigin = "syntax" | "folder-hierarchy";

export interface EdgeRelationship {
	/** What the edge shows — several syntax names are already joined. */
	readonly name: string;
	readonly origin: RelationshipOrigin;
}

/**
 * {@link directedLinkKey}`(source, target)` → the DISTINCT inline-field keys the
 * source note gives its links to that target, in note order. A pair the source
 * never names has no entry.
 */
export type SyntaxRelationshipNames = ReadonlyMap<string, readonly string[]>;

/** Every name source the precedence chain reads. Tasks 2-3 add the stored manual / AI names. */
export interface RelationshipSources {
	readonly syntax: SyntaxRelationshipNames;
}

/** The slice of a {@link GraphEdge} naming depends on. */
export type RelationshipEdge = Pick<GraphEdge, "source" | "target" | "count" | "hierarchy">;

/** A pure folder-hierarchy edge: the folder relation and NO link (dashed, drawn parent → child). */
function isPureHierarchy(edge: RelationshipEdge): boolean {
	return edge.hierarchy && edge.count === 0;
}

function syntaxNamesOf(sources: RelationshipSources, source: VaultPath, target: VaultPath): readonly string[] {
	return sources.syntax.get(directedLinkKey(source, target)) ?? [];
}

/**
 * The name an edge shows, by precedence: note syntax > (manual > AI, tasks 2-3) >
 * the code default. The `parent` default applies only to a PURE hierarchy edge
 * (a merged edge is a link the folder note wrote, and is named like any link),
 * and is HIDDEN when the two notes name each other in EITHER direction — the
 * child's `rel:: [[folder-note]]` says more than the default does.
 */
export function resolveEdgeRelationship(edge: RelationshipEdge, sources: RelationshipSources): EdgeRelationship | null {
	const names = syntaxNamesOf(sources, edge.source, edge.target);
	if (names.length > 0) {
		return { name: names.join(SYNTAX_NAME_SEPARATOR), origin: "syntax" };
	}
	if (isPureHierarchy(edge) && syntaxNamesOf(sources, edge.target, edge.source).length === 0) {
		return { name: PARENT_RELATIONSHIP_NAME, origin: "folder-hierarchy" };
	}
	return null;
}

/** {@link resolveEdgeRelationship} over a build's edges, keyed by {@link directedLinkKey}; unnamed edges have no entry. */
export function resolveEdgeRelationships(
	edges: readonly RelationshipEdge[],
	sources: RelationshipSources,
): ReadonlyMap<string, EdgeRelationship> {
	const resolved = new Map<string, EdgeRelationship>();
	for (const edge of edges) {
		const relationship = resolveEdgeRelationship(edge, sources);
		if (relationship !== null) {
			resolved.set(directedLinkKey(edge.source, edge.target), relationship);
		}
	}
	return resolved;
}

/**
 * The directed pairs whose syntax names {@link resolveEdgeRelationships} reads:
 * every edge's own direction, plus child → folder note for each pure hierarchy
 * edge — that link may be no edge at all (cross links off), yet its name still
 * hides `parent`. Deduplicated, first-seen order.
 */
export function relationshipLookupPairs(edges: readonly RelationshipEdge[]): readonly DirectedLink[] {
	const pairs = new Map<string, DirectedLink>();
	const add = (pair: DirectedLink): void => {
		const key = directedLinkKey(pair.source, pair.target);
		if (!pairs.has(key)) {
			pairs.set(key, pair);
		}
	};
	for (const edge of edges) {
		add({ source: edge.source, target: edge.target });
		if (isPureHierarchy(edge)) {
			add({ source: edge.target, target: edge.source });
		}
	}
	return [...pairs.values()];
}
