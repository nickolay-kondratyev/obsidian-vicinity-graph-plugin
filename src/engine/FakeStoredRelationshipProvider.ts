import type { StoredRelationship, StoredRelationshipNames } from "./EdgeRelationships";
import type { StoredRelationshipProvider } from "./StoredRelationshipProvider";
import type { DirectedLink } from "./types";
import { asVaultPath, directedLinkKey } from "./types";

/** One stored relationship: what is stored for `source → target`. */
export interface FakeStoredRelationship {
	readonly source: string;
	readonly target: string;
	readonly stored: StoredRelationship;
}

/**
 * In-memory {@link StoredRelationshipProvider}. Mirrors the real one's contract:
 * only the REQUESTED directed pairs are answered.
 */
export class FakeStoredRelationshipProvider implements StoredRelationshipProvider {
	private readonly stored: ReadonlyMap<string, StoredRelationship>;

	constructor(stored: readonly FakeStoredRelationship[] = []) {
		this.stored = new Map(
			stored.map((entry) => [directedLinkKey(asVaultPath(entry.source), asVaultPath(entry.target)), entry.stored]),
		);
	}

	storedRelationshipsFor(pairs: readonly DirectedLink[]): Promise<StoredRelationshipNames> {
		const answered = new Map<string, StoredRelationship>();
		for (const pair of pairs) {
			const key = directedLinkKey(pair.source, pair.target);
			const stored = this.stored.get(key);
			if (stored !== undefined) {
				answered.set(key, stored);
			}
		}
		return Promise.resolve(answered);
	}
}
