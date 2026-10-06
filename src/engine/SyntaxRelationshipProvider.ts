import type { SyntaxRelationshipNames } from "./EdgeRelationships";
import type { DirectedLink } from "./types";

/**
 * The names NOTES declare for their links (`rel:: [[target]]`, epic
 * `nid_fc47gtxej6z7fqc53bflme8p5_e`) — an engine-defined port because reading
 * them needs file text, which is async I/O (`vault.cachedRead`). Implemented by
 * `adapters/ObsidianSyntaxRelationshipProvider.ts`; tests use
 * {@link FakeSyntaxRelationshipProvider}.
 */
export interface SyntaxRelationshipProvider {
	/**
	 * The syntax names of exactly the requested directed pairs. A pair whose
	 * source declares no name — or whose source is not a markdown note (canvas
	 * has no syntax names in V1) — has no entry. Never throws for an unknown path.
	 */
	syntaxNamesFor(pairs: readonly DirectedLink[]): Promise<SyntaxRelationshipNames>;
}
