import type { RelationshipName } from "../engine";
import { clearedRelationshipRecord, manualRelationshipRecord, parseRelationshipRecord } from "./relationshipRecord";
import type { RelationshipRecord } from "./relationshipRecord";
import type { VaultFileStore } from "./VaultFileStore";

/** The immediate child directory of the store root holding one `<from_docid>/` dir per SOURCE doc. */
const FROM_ID_SUBDIR = "from_id";
const JSON_SUFFIX = ".json";

/**
 * The stored relationship names (manual + AI; ticket
 * `nid_a5m4kforr9scit68rhqmqh78o_e`, epic `nid_fc47gtxej6z7fqc53bflme8p5_e`) —
 * the THIRD docid-keyed facts store, beside `PluginDataStore` (pins) and
 * `PerDocStore` (overrides + local pins). One file per DIRECTED pair:
 * `from_id/<from_docid>/<to_docid>.json` on the {@link VaultFileStore}, so it
 * syncs as vault content; both halves are docids, so renames are non-events.
 *
 * Read model mirrors `PerDocStore`: {@link warm} loads every record ONCE, lazily
 * on the first build after a restart (a walk of `from_id/` and each from-dir —
 * NOT every vault file), sharing one in-flight walk between concurrent callers.
 * After that the cache is authoritative for the session and reads are
 * synchronous; every write moves the cache BEFORE the disk, like the other two
 * stores, so a failed save still "applies for this session".
 *
 * Relationships are DIRECTED: {@link relationshipFor}`(A, B)` never consults
 * `(B, A)`. The `to → froms` reverse index exists ONLY so {@link forgetDocs} can
 * prune a deleted doc's to-position files without scanning every from-dir.
 */
export class RelationshipStore {
	/** from docid → to docid → record. The session-authoritative copy after {@link warm}. */
	private readonly cache = new Map<string, Map<string, RelationshipRecord>>();
	/** to docid → the from docids holding a record for it (delete pruning only). */
	private readonly reverseIndex = new Map<string, Set<string>>();
	private warmed = false;
	/** In-flight warm, so concurrent callers (a build + the sweep) share ONE directory walk. */
	private warming: Promise<void> | null = null;

	/** @param clock injected epoch-millis source for the records' timestamps. */
	constructor(
		private readonly fileStore: VaultFileStore,
		private readonly clock: () => number,
	) {}

	/**
	 * Loads every `from_id/<from>/<to>.json` into the cache, ONCE. A file that is
	 * absent, quarantined by the primitive (unreadable bytes) or of the wrong shape
	 * reads as no relationship.
	 */
	async warm(): Promise<void> {
		if (this.warmed) {
			return;
		}
		if (this.warming === null) {
			this.warming = this.loadAll();
		}
		try {
			await this.warming;
		} finally {
			this.warming = null;
		}
	}

	private async loadAll(): Promise<void> {
		for (const fromDir of await this.fileStore.listSubdirs(FROM_ID_SUBDIR)) {
			const fromDocid = RelationshipStore.lastSegment(fromDir);
			for (const relPath of await this.fileStore.listKeys(fromDir)) {
				const toDocid = RelationshipStore.toDocidOf(relPath);
				if (toDocid === null) {
					continue;
				}
				const record = parseRelationshipRecord(await this.fileStore.read(relPath));
				if (record !== null) {
					this.remember(fromDocid, toDocid, record);
				}
			}
		}
		this.warmed = true;
	}

	/** The record stored for EXACTLY `from → to` (never the reverse), or undefined. Sync: call after {@link warm}. */
	relationshipFor(fromDocid: string, toDocid: string): RelationshipRecord | undefined {
		return this.cache.get(fromDocid)?.get(toDocid);
	}

	/**
	 * Every docid this store keys state by — from AND to positions, each once. The
	 * read counterpart of {@link forgetDocs}: the read path warms these so a name
	 * renders on the FIRST build after a restart, and the sweep judges them.
	 */
	keyedDocids(): readonly string[] {
		return [...new Set([...this.cache.keys(), ...this.reverseIndex.keys()])];
	}

	/** Names (or renames) `from → to` as the user's MANUAL name, merged over the record read fresh from the cache. */
	async saveManualName(fromDocid: string, toDocid: string, name: RelationshipName): Promise<void> {
		await this.warm();
		const record = manualRelationshipRecord(this.relationshipFor(fromDocid, toDocid), name, this.nowIso());
		await this.writeRecord(fromDocid, toDocid, record);
	}

	/** "Clear": a manual name's file is deleted; an AI name becomes the dismissed marker. */
	async clearName(fromDocid: string, toDocid: string): Promise<void> {
		await this.warm();
		const clear = clearedRelationshipRecord(this.relationshipFor(fromDocid, toDocid), this.nowIso());
		switch (clear.kind) {
			case "unchanged":
				return;
			case "delete":
				await this.removeRecord(fromDocid, toDocid);
				return;
			case "write":
				await this.writeRecord(fromDocid, toDocid, clear.record);
				return;
		}
	}

	/**
	 * Drops every relationship a forgotten doc is part of: its whole from-dir AND
	 * every file naming it in the to-position (found through the reverse index).
	 * The third side-by-side call at the ONE removal choke point (the live delete
	 * handler + the orphan sweep), beside `PluginDataStore.forgetDocs` and
	 * `PerDocStore.forgetDocs`.
	 */
	async forgetDocs(docids: readonly string[]): Promise<void> {
		await this.warm();
		for (const docid of new Set(docids)) {
			for (const toDocid of [...(this.cache.get(docid)?.keys() ?? [])]) {
				await this.removeRecord(docid, toDocid);
			}
			for (const fromDocid of [...(this.reverseIndex.get(docid) ?? [])]) {
				await this.removeRecord(fromDocid, docid);
			}
		}
	}

	private async writeRecord(fromDocid: string, toDocid: string, record: RelationshipRecord): Promise<void> {
		this.remember(fromDocid, toDocid, record);
		await this.fileStore.write(RelationshipStore.relPath(fromDocid, toDocid), record);
	}

	private async removeRecord(fromDocid: string, toDocid: string): Promise<void> {
		this.forget(fromDocid, toDocid);
		await this.fileStore.remove(RelationshipStore.relPath(fromDocid, toDocid));
	}

	private remember(fromDocid: string, toDocid: string, record: RelationshipRecord): void {
		RelationshipStore.entryOf(this.cache, fromDocid, () => new Map()).set(toDocid, record);
		RelationshipStore.entryOf(this.reverseIndex, toDocid, () => new Set()).add(fromDocid);
	}

	private forget(fromDocid: string, toDocid: string): void {
		const targets = this.cache.get(fromDocid);
		targets?.delete(toDocid);
		if (targets?.size === 0) {
			this.cache.delete(fromDocid);
		}
		const sources = this.reverseIndex.get(toDocid);
		sources?.delete(fromDocid);
		if (sources?.size === 0) {
			this.reverseIndex.delete(toDocid);
		}
	}

	private nowIso(): string {
		return new Date(this.clock()).toISOString();
	}

	private static entryOf<K, V>(map: Map<K, V>, key: K, create: () => V): V {
		const existing = map.get(key);
		if (existing !== undefined) {
			return existing;
		}
		const created = create();
		map.set(key, created);
		return created;
	}

	private static relPath(fromDocid: string, toDocid: string): string {
		return `${FROM_ID_SUBDIR}/${fromDocid}/${toDocid}${JSON_SUFFIX}`;
	}

	private static lastSegment(relPath: string): string {
		return relPath.slice(relPath.lastIndexOf("/") + 1);
	}

	/** The to docid a `…/<to_docid>.json` relPath names, or `null` for anything else. */
	private static toDocidOf(relPath: string): string | null {
		const name = RelationshipStore.lastSegment(relPath);
		if (!name.endsWith(JSON_SUFFIX)) {
			return null;
		}
		const docid = name.slice(0, -JSON_SUFFIX.length);
		return docid.length === 0 ? null : docid;
	}
}
