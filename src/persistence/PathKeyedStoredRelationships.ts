import type { DirectedLink, StoredRelationship, StoredRelationshipNames, StoredRelationshipProvider } from "../engine";
import { directedLinkKey } from "../engine";
import type { PathDocIdMap } from "./PathDocIdMap";
import type { RelationshipRecord } from "./relationshipRecord";
import type { RelationshipStore } from "./RelationshipStore";

/**
 * {@link StoredRelationshipProvider} over the docid-keyed {@link RelationshipStore}:
 * translates a build's PATH pairs to docid pairs through the session's
 * {@link PathDocIdMap} — READ-ONLY, no id is ever read from or written to a note
 * here.
 *
 * WHY the map is enough: every docid the store keys is in
 * `RelationshipStore.keyedDocids()`, which the graph build warms
 * (`VicinityGraphBuilder` → `DocIdMapWarmer.warmFor`) before this is asked, and
 * every write maps its own two paths (`PersistenceServices`). So a pair whose
 * paths are unmapped has nothing stored — or names a doc no longer in the vault.
 */
export class PathKeyedStoredRelationships implements StoredRelationshipProvider {
	constructor(
		private readonly store: RelationshipStore,
		private readonly pathDocIdMap: PathDocIdMap,
	) {}

	async storedRelationshipsFor(pairs: readonly DirectedLink[]): Promise<StoredRelationshipNames> {
		await this.store.warm();
		const answered = new Map<string, StoredRelationship>();
		for (const pair of pairs) {
			const record = this.recordFor(pair);
			if (record !== undefined) {
				answered.set(directedLinkKey(pair.source, pair.target), PathKeyedStoredRelationships.storedOf(record));
			}
		}
		return answered;
	}

	private recordFor(pair: DirectedLink): RelationshipRecord | undefined {
		const fromDocid = this.pathDocIdMap.getDocId(pair.source);
		const toDocid = this.pathDocIdMap.getDocId(pair.target);
		if (fromDocid === undefined || toDocid === undefined) {
			return undefined;
		}
		return this.store.relationshipFor(fromDocid, toDocid);
	}

	/** The slice of the record the precedence chain reads. */
	private static storedOf(record: RelationshipRecord): StoredRelationship {
		return record.model === undefined
			? { name: record.name, origin: record.origin }
			: { name: record.name, origin: record.origin, model: record.model };
	}
}
