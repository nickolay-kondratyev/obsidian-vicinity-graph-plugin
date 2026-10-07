import type { StoredRelationshipNames } from "./EdgeRelationships";
import type { DirectedLink } from "./types";

/**
 * The relationship names WE store (manual + AI, ticket
 * `nid_a5m4kforr9scit68rhqmqh78o_e`) for a build's path-keyed edges — an
 * engine-defined port because the store is docid-keyed vault content (async
 * warm-up, path ↔ docid translation). Implemented by
 * `persistence/PathKeyedStoredRelationships.ts`; tests use
 * {@link FakeStoredRelationshipProvider}.
 */
export interface StoredRelationshipProvider {
	/**
	 * The stored relationships of exactly the requested DIRECTED pairs — never the
	 * reverse direction. A pair with nothing stored (or whose notes have no stable
	 * id) has no entry.
	 */
	storedRelationshipsFor(pairs: readonly DirectedLink[]): Promise<StoredRelationshipNames>;
}
