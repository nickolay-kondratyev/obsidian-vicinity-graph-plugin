import type {
	DepthSettings,
	NodeContentOverride,
	NodeExclusionSettings,
	NodeOverride,
	NodeSizeOverridePx,
	ViewSettings,
} from "../engine";
import { clampNodeSizeOverridePx } from "../engine";
import { SerialPromiseChain } from "../shared/SerialPromiseChain";
import type { PinnedDocEntry, PluginData } from "./persistedShapes";
import { PersistedShapes } from "./persistedShapes";
import type { PluginDataPort } from "./storagePorts";

/**
 * ONE field of ONE doc's override — the whole write vocabulary for overrides.
 * A change names a single field (the discipline `SettingsInteraction` already
 * enforces for settings) so no caller ever hands over a COMPLETE entry: the
 * other field is merged in {@link PluginDataStore.saveNodeOverrideField} from
 * state read FRESH there. A caller composing an entry from the rendered graph
 * would clobber whatever a second view — or the other control — stored since
 * that rebuild.
 */
export type NodeOverrideChange =
	| { readonly field: "sizePx"; readonly value: NodeSizeOverridePx }
	| { readonly field: "content"; readonly value: NodeContentOverride };

/** The overridable fields, named on their own for {@link PluginDataStore.clearNodeOverrideField}. */
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
	 * Sets ONE field of a doc's override, merged over the doc's stored entry
	 * read FRESH here — never over an entry the caller composed from a rendered
	 * graph (see {@link NodeOverrideChange}). The pixel box is clamped with the
	 * SAME hard-sanity clamp the load path uses.
	 */
	async saveNodeOverrideField(docid: string, change: NodeOverrideChange): Promise<void> {
		const stored = this.data.nodeOverrides[docid] ?? {};
		await this.putNodeOverride(
			docid,
			change.field === "sizePx"
				? { ...stored, sizePx: clampNodeSizeOverridePx(change.value) }
				: { ...stored, content: change.value },
		);
	}

	/**
	 * Drops ONE field ("inherit this again"), keeping the other. A field that is
	 * already absent is already the desired state, so nothing is written — a
	 * delete/clear of an untouched doc must not rewrite `data.json`.
	 */
	async clearNodeOverrideField(docid: string, field: NodeOverrideField): Promise<void> {
		const stored = this.data.nodeOverrides[docid];
		if (stored === undefined || stored[field] === undefined) {
			return;
		}
		await this.putNodeOverride(docid, PluginDataStore.withoutField(stored, field));
	}

	/**
	 * Drops every docid-keyed trace of the named docs in ONE write — the single
	 * place that knows WHICH maps are docid-keyed, shared by the live
	 * `vault.on('delete')` handler and the orphan sweep, so a third such map is
	 * wired here and nowhere else. Deleting a doc is NOT unpinning it: this is
	 * the only removal that spans maps.
	 */
	async forgetDocs(docids: readonly string[]): Promise<void> {
		const forgotten = new Set(docids);
		const pins = this.data.pins.filter((pin) => !forgotten.has(pin.docid));
		const nodeOverrides = Object.fromEntries(
			Object.entries(this.data.nodeOverrides).filter(([docid]) => !forgotten.has(docid)),
		);
		const removedNothing =
			pins.length === this.data.pins.length &&
			Object.keys(nodeOverrides).length === Object.keys(this.data.nodeOverrides).length;
		if (removedNothing) {
			// Vaults delete files the plugin never persisted anything about.
			return;
		}
		await this.persist({ ...this.data, pins, nodeOverrides });
	}

	/**
	 * The one override write: an entry left with NO field is DELETED — "reset to
	 * inherit everything" and "empty entry" are one operation, so the orphan
	 * shape never reaches disk.
	 */
	private async putNodeOverride(docid: string, override: NodeOverride): Promise<void> {
		const nodeOverrides = { ...this.data.nodeOverrides };
		if (override.sizePx === undefined && override.content === undefined) {
			delete nodeOverrides[docid];
		} else {
			nodeOverrides[docid] = override;
		}
		await this.persist({ ...this.data, nodeOverrides });
	}

	/** The stored entry MINUS one field — rebuilt, since the stored shape is readonly. */
	private static withoutField(override: NodeOverride, field: NodeOverrideField): NodeOverride {
		const { sizePx, content } = override;
		return {
			...(field !== "sizePx" && sizePx !== undefined ? { sizePx } : {}),
			...(field !== "content" && content !== undefined ? { content } : {}),
		};
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
