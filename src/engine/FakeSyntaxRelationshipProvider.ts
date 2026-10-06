import type { SyntaxRelationshipNames } from "./EdgeRelationships";
import type { SyntaxRelationshipProvider } from "./SyntaxRelationshipProvider";
import type { DirectedLink } from "./types";
import { asVaultPath, directedLinkKey } from "./types";

/** One declared name list: what `source` calls its links to `target`. */
export interface FakeSyntaxRelationship {
	readonly source: string;
	readonly target: string;
	readonly names: readonly string[];
}

/**
 * In-memory {@link SyntaxRelationshipProvider}. Mirrors the real adapter's
 * contract: only the REQUESTED pairs are answered, and it records every request
 * so tests can see what was asked.
 */
export class FakeSyntaxRelationshipProvider implements SyntaxRelationshipProvider {
	readonly requests: (readonly DirectedLink[])[] = [];
	private readonly declared: ReadonlyMap<string, readonly string[]>;

	constructor(declared: readonly FakeSyntaxRelationship[] = []) {
		this.declared = new Map(
			declared.map((entry) => [directedLinkKey(asVaultPath(entry.source), asVaultPath(entry.target)), entry.names]),
		);
	}

	syntaxNamesFor(pairs: readonly DirectedLink[]): Promise<SyntaxRelationshipNames> {
		this.requests.push(pairs);
		const answered = new Map<string, readonly string[]>();
		for (const pair of pairs) {
			const key = directedLinkKey(pair.source, pair.target);
			const names = this.declared.get(key);
			if (names !== undefined) {
				answered.set(key, names);
			}
		}
		return Promise.resolve(answered);
	}
}
