import type { DepthSettings, NodeExclusionSettings, NodeOverride, ViewSettings } from "../engine";
import { clampNodeSizeOverridePx } from "../engine";
import { SerialPromiseChain } from "../shared/SerialPromiseChain";
import type { PinnedDocEntry, PluginData } from "./persistedShapes";
import { PersistedShapes } from "./persistedShapes";
import type { PluginDataPort } from "./storagePorts";

/**
 * Typed owner of the plugin's `data.json` (global settings + the docid-keyed
 * pinned set and per-node overrides).
 * Holds the parsed state in memory after {@link init}; every mutation
 * persists through a serialized write chain (last write wins, no interleaved
 * saveData calls).
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

	hasPin(docid: string): boolean {
		return this.data.pins.some((pin) => pin.docid === docid);
	}

	nodeOverrides(): Readonly<Record<string, NodeOverride>> {
		return this.data.nodeOverrides;
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
	 * Stores the COMPLETE desired override for one doc (callers compose partial
	 * changes over {@link nodeOverrides} themselves). The pixel box is clamped
	 * with the SAME hard-sanity clamp the load path uses; an override with
	 * NEITHER field DELETES the entry — "reset to inherit everything" and "empty
	 * entry" are one operation, so the orphan shape never reaches disk.
	 */
	async saveNodeOverride(docid: string, override: NodeOverride): Promise<void> {
		const sizePx = override.sizePx === undefined ? undefined : clampNodeSizeOverridePx(override.sizePx);
		if (sizePx === undefined && override.content === undefined) {
			await this.removeNodeOverrides([docid]);
			return;
		}
		const entry: NodeOverride = {
			...(sizePx !== undefined ? { sizePx } : {}),
			...(override.content !== undefined ? { content: override.content } : {}),
		};
		await this.persist({ ...this.data, nodeOverrides: { ...this.data.nodeOverrides, [docid]: entry } });
	}

	async removeNodeOverrides(docids: readonly string[]): Promise<void> {
		const removed = new Set(docids);
		const remaining = Object.fromEntries(
			Object.entries(this.data.nodeOverrides).filter(([docid]) => !removed.has(docid)),
		);
		await this.persist({ ...this.data, nodeOverrides: remaining });
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
