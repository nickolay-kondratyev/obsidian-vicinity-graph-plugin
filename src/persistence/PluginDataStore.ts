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
import type { LocalPinsByMainDocid, PinnedDocEntry, PluginData } from "./persistedShapes";
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

	/** The active main's locally-pinned targets — empty for a main with no local pins. */
	localPins(mainDocid: string): readonly PinnedDocEntry[] {
		return this.data.localPins[mainDocid] ?? [];
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
	 * Adds (or re-pins, refreshing the timestamp — mirrors {@link addPin} dedupe) a
	 * target under one MAIN. Local pins are the ONLY docid-keyed MAP-of-lists, so
	 * the merge is over the main's own list only; every other main is untouched.
	 */
	async addLocalPin(mainDocid: string, targetDocid: string, pinTimestamp: number): Promise<void> {
		const existing = (this.data.localPins[mainDocid] ?? []).filter((pin) => pin.docid !== targetDocid);
		await this.persist({
			...this.data,
			localPins: { ...this.data.localPins, [mainDocid]: [...existing, { docid: targetDocid, pinTimestamp }] },
		});
	}

	/**
	 * Removes the named targets from ONE main's local-pin list; a main left with
	 * NO targets drops its key entirely (no empty list persists — the parser drops
	 * such a shape anyway). An unknown main / target is already the desired state.
	 */
	async removeLocalPins(mainDocid: string, targetDocids: readonly string[]): Promise<void> {
		const current = this.data.localPins[mainDocid];
		if (current === undefined) {
			return;
		}
		const removed = new Set(targetDocids);
		const remaining = current.filter((pin) => !removed.has(pin.docid));
		if (remaining.length === current.length) {
			return;
		}
		await this.persist({ ...this.data, localPins: PluginDataStore.withLocalPinList(this.data.localPins, mainDocid, remaining) });
	}

	/** One main's local-pin list replaced — or the KEY dropped when the list is empty (no orphan main). */
	private static withLocalPinList(
		localPins: LocalPinsByMainDocid,
		mainDocid: string,
		targets: readonly PinnedDocEntry[],
	): LocalPinsByMainDocid {
		const next = { ...localPins };
		if (targets.length === 0) {
			delete next[mainDocid];
		} else {
			next[mainDocid] = targets;
		}
		return next;
	}

	/**
	 * Sets ONE field of a doc's override, merged over the doc's stored entry
	 * read FRESH here — never over an entry the caller composed from a rendered
	 * graph (see {@link NodeOverrideChange}). The pixel box goes through the SAME
	 * hard-sanity rule the load path uses, which can also REFUSE it outright.
	 */
	async saveNodeOverrideField(docid: string, change: NodeOverrideChange): Promise<void> {
		const written = PluginDataStore.storedForm(change);
		if (written === undefined) {
			// An unusable value (a non-finite pixel box) carries no intent, and an
			// override has no default to fall back to — so it stores NOTHING and
			// leaves the field as it was, exactly as the load path drops such a box.
			return;
		}
		const stored = this.data.nodeOverrides[docid] ?? {};
		await this.putNodeOverride(docid, { ...stored, ...written });
	}

	/**
	 * ONE change as its stored one-field shape, or `undefined` when the value is
	 * unusable — the only place a written override value is normalized. The
	 * switch is exhaustive on purpose: a new {@link NodeOverrideChange} variant
	 * fails to compile here (noImplicitReturns) instead of silently landing
	 * under another field's key.
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
	 * Every docid this store keys state by — pins ∪ per-node overrides, each once.
	 * The READ counterpart of {@link forgetDocs}: both answer "WHICH maps are
	 * docid-keyed" from this one file, so a third such map is pruned AND warmed by
	 * editing here. The read path warms exactly this list (`DocIdMapWarmer`), and a
	 * list a caller assembled itself would silently omit the new map — leaving it
	 * invisible on the first build after a restart (ticket
	 * nid_gbyqsuplz8b7pv0u5k34sdz1q_e).
	 */
	docIdKeyedDocids(): readonly string[] {
		return [
			...new Set([
				...this.data.pins.map((pin) => pin.docid),
				...Object.keys(this.data.nodeOverrides),
				...this.localPinDocids(),
			]),
		];
	}

	/**
	 * Every docid a local pin references — MAIN keys AND their TARGET docids, each
	 * once. Both positions must resolve to a path for the map to render, so both
	 * are warmed AND both are candidates for the orphan sweep (a deleted doc can be
	 * either). Shared by {@link docIdKeyedDocids} (warm side) and the sweep.
	 */
	localPinDocids(): readonly string[] {
		return [
			...new Set([
				...Object.keys(this.data.localPins),
				...Object.values(this.data.localPins).flatMap((targets) => targets.map((pin) => pin.docid)),
			]),
		];
	}

	/**
	 * Drops every docid-keyed trace of the named docs in ONE write — the single
	 * place that knows WHICH maps are docid-keyed on the REMOVAL side, shared by
	 * the live `vault.on('delete')` handler and the orphan sweep
	 * ({@link docIdKeyedDocids} is its read-side twin). Deleting a doc is NOT
	 * unpinning it: this is the only removal that spans maps.
	 */
	async forgetDocs(docids: readonly string[]): Promise<void> {
		const forgotten = new Set(docids);
		const pins = this.data.pins.filter((pin) => !forgotten.has(pin.docid));
		const nodeOverrides = Object.fromEntries(
			Object.entries(this.data.nodeOverrides).filter(([docid]) => !forgotten.has(docid)),
		);
		// A forgotten doc can be a local-pin KEY (its whole main entry goes) AND a
		// TARGET under other mains (pruned from every list). A main left with no
		// targets after pruning drops its key — the same no-orphan-main rule as
		// {@link removeLocalPins}.
		const localPins = PluginDataStore.forgetFromLocalPins(this.data.localPins, forgotten);
		const removedNothing =
			pins.length === this.data.pins.length &&
			Object.keys(nodeOverrides).length === Object.keys(this.data.nodeOverrides).length &&
			localPins === this.data.localPins;
		if (removedNothing) {
			// Vaults delete files the plugin never persisted anything about.
			return;
		}
		await this.persist({ ...this.data, pins, localPins, nodeOverrides });
	}

	/**
	 * Drops forgotten docs from BOTH local-pin positions (main key and target).
	 * Returns the SAME reference when nothing changed, so {@link forgetDocs} can
	 * detect a pure no-op across every map by identity.
	 */
	private static forgetFromLocalPins(localPins: LocalPinsByMainDocid, forgotten: ReadonlySet<string>): LocalPinsByMainDocid {
		let changed = false;
		const next: Record<string, readonly PinnedDocEntry[]> = {};
		for (const [mainDocid, targets] of Object.entries(localPins)) {
			if (forgotten.has(mainDocid)) {
				changed = true;
				continue;
			}
			const prunedTargets = targets.filter((pin) => !forgotten.has(pin.docid));
			if (prunedTargets.length === 0) {
				changed = true;
				continue;
			}
			if (prunedTargets.length !== targets.length) {
				changed = true;
			}
			next[mainDocid] = prunedTargets;
		}
		return changed ? next : localPins;
	}

	/**
	 * The one override write: an entry left with NO field is DELETED — "reset to
	 * inherit everything" and "empty entry" are one operation, so the orphan
	 * shape never reaches disk.
	 *
	 * Emptiness is asked of the KEYS, never of a hand-listed pair of fields: an
	 * entry never carries an explicit-`undefined` field (the parser keeps only
	 * present ones, {@link storedForm} writes exactly one, {@link withoutField}
	 * deletes), so a field added to {@link NodeOverride} needs no edit here — the
	 * hand-listed version would have deleted an entry holding only the new field.
	 */
	private async putNodeOverride(docid: string, override: NodeOverride): Promise<void> {
		const nodeOverrides = { ...this.data.nodeOverrides };
		if (Object.keys(override).length === 0) {
			delete nodeOverrides[docid];
		} else {
			nodeOverrides[docid] = override;
		}
		await this.persist({ ...this.data, nodeOverrides });
	}

	/** The stored entry MINUS one field — copied, since the stored shape is readonly. */
	private static withoutField(override: NodeOverride, field: NodeOverrideField): NodeOverride {
		const remaining = { ...override };
		delete remaining[field];
		return remaining;
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
