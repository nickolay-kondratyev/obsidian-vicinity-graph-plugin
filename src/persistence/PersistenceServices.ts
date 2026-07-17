import type { DocIdPort, VaultFilePort } from "../adapters/obsidianPorts";
import type { DepthOverride, ViewSettings } from "../engine";
import { DocDataMutations } from "./DocDataMutations";
import type { PersistableIdentity } from "./DocPersistEligibility";
import { DocPersistEligibility } from "./DocPersistEligibility";
import type { DocDataStore } from "./DocDataStore";
import type { PathDocIdMap } from "./PathDocIdMap";
import type { PluginDataStore } from "./PluginDataStore";

/**
 * The doc-scoped write-intent facade for steps 04/06: every entry point is an
 * EXPLICIT user action on one doc, so this is the only place that calls
 * `ensureDocId` (id-lib contract: never ensure ids on read/bulk paths), and
 * every entry point returns the {@link PersistableIdentity} verdict — refused
 * docs (Q3: no docid / unsafe foreign docid) persist NOTHING and the typed
 * reason feeds the future node emblem. Global settings have no doc identity
 * involved — callers use {@link PluginDataStore} directly.
 */
export class PersistenceServices {
	constructor(
		private readonly docIdPort: DocIdPort,
		private readonly pluginDataStore: PluginDataStore,
		private readonly docDataStore: DocDataStore,
		private readonly pathDocIdMap: PathDocIdMap,
		private readonly clock: () => number = Date.now,
	) {}

	async pinDoc(file: VaultFilePort): Promise<PersistableIdentity> {
		return this.withPersistableIdentity(file, (docid) => this.pluginDataStore.addPin(docid, this.clock()));
	}

	/** Removes the pin only; its `centralDepths` traces in other docs self-heal via the sweep. */
	async unpinDoc(docid: string): Promise<void> {
		await this.pluginDataStore.removePins([docid]);
	}

	/** Pin-on-toggle: writes the field even when it equals the global default; `undefined` reverts to inherit. */
	async setDocDepthField(
		file: VaultFilePort,
		field: keyof DepthOverride,
		value: number | undefined,
	): Promise<PersistableIdentity> {
		return this.updateDocData(file, (doc) => DocDataMutations.setDepthField(doc, field, value));
	}

	/** Pin-on-toggle: writes the field even when it equals the global default; `undefined` reverts to inherit. */
	async setDocViewField<K extends keyof ViewSettings>(
		file: VaultFilePort,
		field: K,
		value: ViewSettings[K] | undefined,
	): Promise<PersistableIdentity> {
		return this.updateDocData(file, (doc) => DocDataMutations.setViewField(doc, field, value));
	}

	/** Depth adjusted on a pinned central while `mainFile` is MAIN → persisted under MAIN's doc-data. */
	async setCentralDepthField(
		mainFile: VaultFilePort,
		centralDocid: string,
		field: keyof DepthOverride,
		value: number | undefined,
	): Promise<PersistableIdentity> {
		return this.updateDocData(mainFile, (doc) =>
			DocDataMutations.setCentralDepthField(doc, centralDocid, field, value),
		);
	}

	private updateDocData(
		file: VaultFilePort,
		mutate: Parameters<DocDataStore["update"]>[1],
	): Promise<PersistableIdentity> {
		return this.withPersistableIdentity(file, async (docid) => {
			await this.docDataStore.update(docid, mutate);
		});
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
