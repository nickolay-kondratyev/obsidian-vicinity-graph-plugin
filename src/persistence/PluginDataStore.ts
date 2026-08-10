import type { DepthSettings, NodeExclusionSettings, ViewSettings } from "../engine";
import { SerialPromiseChain } from "../shared/SerialPromiseChain";
import type { PinnedDocEntry, PluginData } from "./persistedShapes";
import { PersistedShapes } from "./persistedShapes";
import type { PluginDataPort } from "./storagePorts";

/**
 * Typed owner of the plugin's `data.json`: the truly-global config dials
 * (`globalDepths`, `globalView`, `nodeExclusion`) AND the GLOBAL pinned set —
 * the one docid-keyed map the owner kept here (Obsidian-managed, one cheap
 * in-memory read) when the per-doc/per-main maps (`nodeOverrides`, `localPins`)
 * moved onto the per-file store ({@link ./PerDocStore PerDocStore}; ticket
 * `nid_8f8ey41extajt08zphwwxhnwq_e`).
 *
 * Holds the parsed state in memory after {@link init}; every mutation persists
 * through a serialized write chain (last write wins, no interleaved saveData
 * calls).
 */
export class PluginDataStore {
	private data: PluginData = PersistedShapes.defaultPluginData();
	private readonly writes = new SerialPromiseChain();

	constructor(private readonly port: PluginDataPort) {}

	/** Loads and defensively parses data.json (first run / malformed → defaults). */
	async init(): Promise<void> {
		this.data = PersistedShapes.parsePluginData(await this.port.loadData());
	}

	globalDepths(): DepthSettings {
		return this.data.globalDepths;
	}

	globalView(): ViewSettings {
		return this.data.globalView;
	}

	pins(): readonly PinnedDocEntry[] {
		return this.data.pins;
	}

	nodeExclusion(): NodeExclusionSettings {
		return this.data.nodeExclusion;
	}

	async saveGlobalDepths(globalDepths: DepthSettings): Promise<void> {
		await this.persist({ ...this.data, globalDepths });
	}

	async saveGlobalView(globalView: ViewSettings): Promise<void> {
		await this.persist({ ...this.data, globalView });
	}

	async saveNodeExclusion(nodeExclusion: NodeExclusionSettings): Promise<void> {
		await this.persist({ ...this.data, nodeExclusion });
	}

	/** Re-pinning refreshes the timestamp (recency tiebreaker follows the newest pin intent). */
	async addPin(docid: string, pinTimestamp: number): Promise<void> {
		const withoutExisting = this.data.pins.filter((pin) => pin.docid !== docid);
		await this.persist({ ...this.data, pins: [...withoutExisting, { docid, pinTimestamp }] });
	}

	async removePins(docids: readonly string[]): Promise<void> {
		const removed = new Set(docids);
		await this.persist({ ...this.data, pins: this.data.pins.filter((pin) => !removed.has(pin.docid)) });
	}

	/**
	 * Drops the named docs from the GLOBAL pinned set (the only docid-keyed map
	 * still in `data.json`). Deleting a doc is NOT unpinning it, and it spans more
	 * than the pinned set — the per-file facts are dropped by
	 * {@link ./PerDocStore.PerDocStore.forgetDocs}, invoked alongside this by the
	 * live `vault.on('delete')` handler and the orphan sweep. A doc the pinned set
	 * never held is left untouched (vaults delete files the plugin never pinned).
	 */
	async forgetDocs(docids: readonly string[]): Promise<void> {
		const forgotten = new Set(docids);
		const pins = this.data.pins.filter((pin) => !forgotten.has(pin.docid));
		if (pins.length === this.data.pins.length) {
			return;
		}
		await this.persist({ ...this.data, pins });
	}

	/**
	 * In-memory state moves NOW, the disk write is serialised. The chain owns
	 * rejection isolation and caller-visible failure (see {@link SerialPromiseChain}).
	 */
	private persist(updated: PluginData): Promise<void> {
		this.data = updated;
		return this.writes.run(() => this.port.saveData(this.data));
	}
}
