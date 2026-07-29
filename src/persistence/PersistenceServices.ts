import type { DocIdPort, VaultFilePort } from "../adapters/obsidianPorts";
import type { PersistableIdentity } from "./DocPersistEligibility";
import { DocPersistEligibility } from "./DocPersistEligibility";
import type { PathDocIdMap } from "./PathDocIdMap";
import type { PluginDataStore } from "./PluginDataStore";

/**
 * The doc-scoped write-intent facade: every entry point is an EXPLICIT user
 * action on one doc, so this is the only place that calls `ensureDocId` (id-lib
 * contract: never ensure ids on read/bulk paths), and pinning returns the
 * {@link PersistableIdentity} verdict — a refused doc (Q3: no docid / unsafe
 * foreign docid) persists NOTHING and the typed reason feeds the node emblem.
 *
 * Settings have NO doc identity involved (they are global) — callers use
 * {@link PluginDataStore} directly. What is left doc-scoped is the pinned set,
 * which is itself stored globally in `data.json` but keyed by docid.
 */
export class PersistenceServices {
	constructor(
		private readonly docIdPort: DocIdPort,
		private readonly pluginDataStore: PluginDataStore,
		private readonly pathDocIdMap: PathDocIdMap,
		private readonly clock: () => number = Date.now,
	) {}

	async pinDoc(file: VaultFilePort): Promise<PersistableIdentity> {
		return this.withPersistableIdentity(file, (docid) => this.pluginDataStore.addPin(docid, this.clock()));
	}

	async unpinDoc(docid: string): Promise<void> {
		await this.pluginDataStore.removePins([docid]);
	}

	/** ensureDocId (write intent!) → Q3 classification → persist only on a "persistable" verdict. */
	private async withPersistableIdentity(
		file: VaultFilePort,
		persist: (docid: string) => Promise<void>,
	): Promise<PersistableIdentity> {
		const identity = DocPersistEligibility.classify(await this.docIdPort.ensureDocId(file));
		if (identity.kind === "persistable") {
			this.pathDocIdMap.set(file.path, identity.docid);
			await persist(identity.docid);
		}
		return identity;
	}
}
