import type { NodeContentOverride, NodeOverride, NodeSizeOverridePx } from "../engine";
import { clampNodeSizeOverridePx } from "../engine";
import { isEmptyPerDocRecord, parsePerDocRecord } from "./perDocRecord";
import type { PerDocRecord } from "./perDocRecord";
import type { PinnedDocEntry } from "./persistedShapes";
import type { VaultFileStore } from "./VaultFileStore";

/**
 * ONE field of ONE doc's override — the whole write vocabulary for overrides.
 * A change names a single field (the discipline `SettingsInteraction` already
 * enforces for settings) so no caller ever hands over a COMPLETE entry: the
 * other field is merged in {@link PerDocStore.saveNodeOverrideField} from the
 * record read FRESH (from the warmed cache) there. A caller composing an entry
 * from the rendered graph would clobber whatever a second view — or the other
 * control — stored since that rebuild.
 */
export type NodeOverrideChange =
	| { readonly field: "sizePx"; readonly value: NodeSizeOverridePx }
	| { readonly field: "content"; readonly value: NodeContentOverride };

/** The overridable fields, named on their own for {@link PerDocStore.clearNodeOverrideField}. */
export type NodeOverrideField = NodeOverrideChange["field"];

/**
 * Compile-time completeness: a field added to {@link NodeOverride} surfaces
 * here as a type error until {@link NodeOverrideChange} can carry it — an
 * override field with no way to write or clear it would be dead storage.
 */
type UnwritableOverrideField = Exclude<keyof NodeOverride, NodeOverrideField>;
export const _assertEveryNodeOverrideFieldWritable: UnwritableOverrideField extends never
	? true
	: UnwritableOverrideField = true;

/** The immediate child directory of the store root that holds `<docid>.json` files. */
const PER_FILE_SUBDIR = "per_file";
const JSON_SUFFIX = ".json";

/** Mutable twin of {@link PerDocRecord} for building the next record before it is frozen into the cache. */
type MutablePerDocRecord = {
	override?: NodeOverride;
	localPins?: readonly PinnedDocEntry[];
	localControls?: Readonly<Record<string, unknown>>;
};

/**
 * The per-doc / per-main persisted state that moved OUT of `data.json` onto the
 * {@link VaultFileStore} (ticket `nid_8f8ey41extajt08zphwwxhnwq_e`): each doc's
 * SUBJECT override (`sizePx` / `content`) and its MAIN-context `localPins`, one
 * `per_file/<docid>.json` file per doc, syncing as vault content. `data.json`
 * keeps the truly-global dials AND the global pinned set; this store owns the two
 * maps that left it. Adding the future `localControls` map is a change HERE only —
 * the same "one place knows which maps are docid-keyed" role `PluginDataStore`
 * kept for the pinned set.
 *
 * Read model (mirrors `PluginDataStore`'s in-memory-authoritative model over
 * `data.json`): {@link warm} loads every existing record into an in-memory cache
 * ONCE — lazily, on the first graph build after a restart, NOT at plugin init and
 * NOT by reading every file in the vault (only the per-file records, learned from
 * one directory listing). After that the cache is authoritative for the session
 * and every read is synchronous; writes keep it and the disk file consistent.
 * Cross-process sync edits are picked up at the next session's warm — exactly the
 * guarantee `data.json` gives, and the reason a conflict there is quarantined
 * rather than merged live.
 *
 * A reverse index (`target docid → set of main docids that locally-pin it`) makes
 * deleting a doc that OTHER mains pin as a target a cheap, targeted rewrite; it is
 * best-effort (among the loaded records) because the orphan sweep re-derives the
 * same truth authoritatively.
 */
export class PerDocStore {
	/** docid → its record. The session-authoritative copy after {@link warm}. */
	private readonly cache = new Map<string, PerDocRecord>();
	/** target docid → the main docids whose `localPins` list references it. */
	private readonly reverseIndex = new Map<string, Set<string>>();
	private warmed = false;
	/** In-flight warm, so concurrent callers (a build + the sweep) share ONE directory walk. */
	private warming: Promise<void> | null = null;

	constructor(private readonly fileStore: VaultFileStore) {}

	/**
	 * Loads every `per_file/<docid>.json` into the cache, ONCE. Idempotent and
	 * concurrency-safe (a build and the sweep share the in-flight walk). A file
	 * that is absent/quarantined (the primitive set aside a conflict) is skipped,
	 * so that doc reads as defaults — the field-level degrade is separate and
	 * already happened in {@link parsePerDocRecord}.
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
		for (const relPath of await this.fileStore.listKeys(PER_FILE_SUBDIR)) {
			const docid = PerDocStore.docidOf(relPath);
			if (docid === null) {
				continue;
			}
			const payload = await this.fileStore.read(relPath);
			if (payload === null) {
				continue;
			}
			const record = parsePerDocRecord(payload);
			if (isEmptyPerDocRecord(record)) {
				continue;
			}
			this.cache.set(docid, record);
			this.indexTargets(docid, record.localPins);
		}
		this.warmed = true;
	}

	/** The active main's locally-pinned targets — empty for a main with no local pins. */
	localPins(mainDocid: string): readonly PinnedDocEntry[] {
		return this.cache.get(mainDocid)?.localPins ?? [];
	}

	/** Every docid → its SUBJECT override, for the docs that have one. */
	nodeOverrides(): Readonly<Record<string, NodeOverride>> {
		const overrides: Record<string, NodeOverride> = {};
		for (const [docid, record] of this.cache) {
			if (record.override !== undefined) {
				overrides[docid] = record.override;
			}
		}
		return overrides;
	}

	/** Docids carrying a subject override (the sweep's override-orphan candidates). */
	overrideDocids(): readonly string[] {
		const docids: string[] = [];
		for (const [docid, record] of this.cache) {
			if (record.override !== undefined) {
				docids.push(docid);
			}
		}
		return docids;
	}

	/**
	 * Every docid a local pin references — MAIN keys AND their TARGET docids, each
	 * once. Both positions must resolve to a path to render, so both are warmed AND
	 * both are orphan-sweep candidates (a deleted doc can be either).
	 */
	localPinDocids(): readonly string[] {
		const docids = new Set<string>(this.reverseIndex.keys());
		for (const [docid, record] of this.cache) {
			if (record.localPins !== undefined && record.localPins.length > 0) {
				docids.add(docid);
			}
		}
		return [...docids];
	}

	/**
	 * Every docid this store keys state by — subject-override docids, local-pin
	 * main keys AND their targets, each once. The READ counterpart, for THIS
	 * store, of {@link forgetDocs}: the read path warms exactly this list so a doc's
	 * override/localPins render on the FIRST build after a restart. The pinned set's
	 * docids come from `PluginDataStore`; the builder unions the two.
	 */
	keyedDocids(): readonly string[] {
		return [...new Set([...this.cache.keys(), ...this.reverseIndex.keys()])];
	}

	/**
	 * Sets ONE field of a doc's override, merged over the record read FRESH from the
	 * warmed cache — never over a record the caller composed from a rendered graph.
	 * The pixel box goes through the SAME hard-sanity clamp the load path uses,
	 * which can also REFUSE it outright (a non-finite box has no default to fall
	 * back to, so it stores NOTHING and leaves the field as it was).
	 */
	async saveNodeOverrideField(docid: string, change: NodeOverrideChange): Promise<void> {
		await this.warm();
		const written = PerDocStore.storedForm(change);
		if (written === undefined) {
			return;
		}
		const current = this.cache.get(docid) ?? {};
		const override = { ...current.override, ...written };
		await this.writeRecord(docid, { ...current, override });
	}

	/**
	 * Drops ONE override field ("inherit this again"), keeping the other. A field
	 * already absent is already the desired state, so nothing is written — matching
	 * the load path and the read-only clear semantics `PersistenceServices` relies on.
	 * A record left with no section at all is deleted, not written empty.
	 */
	async clearNodeOverrideField(docid: string, field: NodeOverrideField): Promise<void> {
		await this.warm();
		const current = this.cache.get(docid);
		if (current?.override?.[field] === undefined) {
			return;
		}
		const override = { ...current.override };
		delete override[field];
		const next: MutablePerDocRecord = { ...current };
		if (Object.keys(override).length === 0) {
			delete next.override;
		} else {
			next.override = override;
		}
		await this.writeRecord(docid, next);
	}

	/**
	 * Adds (or re-pins, refreshing the timestamp — mirrors the global pin dedupe) a
	 * target under one MAIN's `localPins`. Merged over the main's record read fresh
	 * from the warmed cache; every other doc's file is untouched.
	 */
	async addLocalPin(mainDocid: string, targetDocid: string, pinTimestamp: number): Promise<void> {
		await this.warm();
		const current = this.cache.get(mainDocid) ?? {};
		const existing = (current.localPins ?? []).filter((pin) => pin.docid !== targetDocid);
		await this.writeRecord(mainDocid, { ...current, localPins: [...existing, { docid: targetDocid, pinTimestamp }] });
	}

	/**
	 * Removes the named targets from ONE main's local-pin list; a main left with NO
	 * targets drops the section (and, if that was its only section, its file). An
	 * unknown main / target is already the desired state — nothing is written.
	 */
	async removeLocalPins(mainDocid: string, targetDocids: readonly string[]): Promise<void> {
		await this.warm();
		const current = this.cache.get(mainDocid);
		if (current?.localPins === undefined) {
			return;
		}
		const removed = new Set(targetDocids);
		const remaining = current.localPins.filter((pin) => !removed.has(pin.docid));
		if (remaining.length === current.localPins.length) {
			return;
		}
		await this.writeRecord(mainDocid, PerDocStore.withLocalPins(current, remaining));
	}

	/**
	 * Drops every per-file trace of the named docs: each doc's OWN file (its subject
	 * override + its localPins-as-main) AND its appearance as a TARGET under every
	 * OTHER main's list. The per-file analogue of `PluginDataStore.forgetDocs` (the
	 * pinned set) — the two together are the ONE conceptual choke point deleting a
	 * doc spans, invoked side by side by the live delete handler and the sweep.
	 * Deleting a doc is NOT unpinning it.
	 */
	async forgetDocs(docids: readonly string[]): Promise<void> {
		await this.warm();
		const forgotten = new Set(docids);
		const affectedMains = new Set<string>();
		for (const docid of forgotten) {
			for (const main of this.reverseIndex.get(docid) ?? []) {
				if (!forgotten.has(main)) {
					affectedMains.add(main);
				}
			}
		}
		// Remove each forgotten doc's OWN record wholesale (subject + main-context).
		for (const docid of forgotten) {
			if (this.cache.has(docid)) {
				await this.writeRecord(docid, {});
			}
		}
		// Prune the forgotten docs as TARGETS from every surviving main that pinned them.
		for (const mainDocid of affectedMains) {
			const current = this.cache.get(mainDocid);
			if (current?.localPins === undefined) {
				continue;
			}
			const remaining = current.localPins.filter((pin) => !forgotten.has(pin.docid));
			if (remaining.length !== current.localPins.length) {
				await this.writeRecord(mainDocid, PerDocStore.withLocalPins(current, remaining));
			}
		}
	}

	/**
	 * The ONE write: a record with every section empty is DELETED (its file
	 * removed), never written empty — "reset to inherit everything" and "empty
	 * record" are one operation, mirroring the node-override rule. The reverse index
	 * is reconciled against the previous record before the file is touched.
	 */
	private async writeRecord(docid: string, next: PerDocRecord): Promise<void> {
		const relPath = PerDocStore.relPath(docid);
		const previous = this.cache.get(docid);
		this.reindexTargets(docid, previous?.localPins, next.localPins);
		if (isEmptyPerDocRecord(next)) {
			this.cache.delete(docid);
			await this.fileStore.remove(relPath);
		} else {
			this.cache.set(docid, next);
			await this.fileStore.write(relPath, next);
		}
	}

	/** `current` with its `localPins` replaced — or the section dropped when the list is empty. */
	private static withLocalPins(current: PerDocRecord, localPins: readonly PinnedDocEntry[]): PerDocRecord {
		const next: MutablePerDocRecord = { ...current };
		if (localPins.length === 0) {
			delete next.localPins;
		} else {
			next.localPins = localPins;
		}
		return next;
	}

	/** Records that `mainDocid` locally-pins each target (warm-time index fill). */
	private indexTargets(mainDocid: string, localPins: readonly PinnedDocEntry[] | undefined): void {
		for (const pin of localPins ?? []) {
			this.mainsPinning(pin.docid).add(mainDocid);
		}
	}

	/** Reconciles the reverse index when `mainDocid`'s target list changes from `previous` to `next`. */
	private reindexTargets(
		mainDocid: string,
		previous: readonly PinnedDocEntry[] | undefined,
		next: readonly PinnedDocEntry[] | undefined,
	): void {
		for (const pin of previous ?? []) {
			const mains = this.reverseIndex.get(pin.docid);
			if (mains !== undefined) {
				mains.delete(mainDocid);
				if (mains.size === 0) {
					this.reverseIndex.delete(pin.docid);
				}
			}
		}
		this.indexTargets(mainDocid, next);
	}

	private mainsPinning(targetDocid: string): Set<string> {
		const existing = this.reverseIndex.get(targetDocid);
		if (existing !== undefined) {
			return existing;
		}
		const created = new Set<string>();
		this.reverseIndex.set(targetDocid, created);
		return created;
	}

	/**
	 * ONE change as its stored one-field shape, or `undefined` when the value is
	 * unusable (a non-finite pixel box). The switch is exhaustive on purpose: a new
	 * {@link NodeOverrideChange} variant fails to compile here (noImplicitReturns)
	 * instead of silently landing under another field's key.
	 */
	private static storedForm(change: NodeOverrideChange): NodeOverride | undefined {
		switch (change.field) {
			case "sizePx": {
				const sizePx = clampNodeSizeOverridePx(change.value);
				return sizePx === undefined ? undefined : { sizePx };
			}
			case "content":
				return { content: change.value };
		}
	}

	private static relPath(docid: string): string {
		return `${PER_FILE_SUBDIR}/${docid}${JSON_SUFFIX}`;
	}

	/** The docid a `per_file/<docid>.json` relPath names, or `null` for anything else. */
	private static docidOf(relPath: string): string | null {
		const prefix = `${PER_FILE_SUBDIR}/`;
		if (!relPath.startsWith(prefix) || !relPath.endsWith(JSON_SUFFIX)) {
			return null;
		}
		const docid = relPath.slice(prefix.length, -JSON_SUFFIX.length);
		return docid.length === 0 ? null : docid;
	}
}
