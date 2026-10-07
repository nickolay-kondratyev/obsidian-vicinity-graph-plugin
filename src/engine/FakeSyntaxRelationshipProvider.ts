import type { SyntaxRelationshipRead } from "./EdgeRelationships";
import type { SyntaxRelationshipProvider } from "./SyntaxRelationshipProvider";
import type { DirectedLink, VaultPath } from "./types";
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
 * so tests can see what was asked. A source in `unreadSources` answers as the real
 * adapter does over a lagging link cache: listed as unread, none of its names given.
 */
export class FakeSyntaxRelationshipProvider implements SyntaxRelationshipProvider {
	readonly requests: (readonly DirectedLink[])[] = [];
	private readonly declared: ReadonlyMap<string, readonly string[]>;

	constructor(
		declared: readonly FakeSyntaxRelationship[] = [],
		private readonly unreadSources: ReadonlySet<VaultPath> = new Set(),
	) {
		this.declared = new Map(
			declared.map((entry) => [directedLinkKey(asVaultPath(entry.source), asVaultPath(entry.target)), entry.names]),
		);
	}

	syntaxNamesFor(pairs: readonly DirectedLink[]): Promise<SyntaxRelationshipRead> {
		this.requests.push(pairs);
		const answered = new Map<string, readonly string[]>();
		const unread = new Set<VaultPath>();
		for (const pair of pairs) {
			if (this.unreadSources.has(pair.source)) {
				unread.add(pair.source);
				continue;
			}
			const key = directedLinkKey(pair.source, pair.target);
			const names = this.declared.get(key);
			if (names !== undefined) {
				answered.set(key, names);
			}
		}
		return Promise.resolve({ names: answered, unreadSources: unread });
	}
}
