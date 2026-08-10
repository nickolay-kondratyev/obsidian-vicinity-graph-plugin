import type { DocIdMapWarmer } from "./DocIdMapWarmer";
import type { PathDocIdMap } from "./PathDocIdMap";
import type { PerDocStore } from "./PerDocStore";
import type { PluginDataStore } from "./PluginDataStore";
import type { SweepPlan } from "./SweepPlanner";
import { SweepPlanner } from "./SweepPlanner";

/** Sweep starts ~15s after plugin load (step doc) — vault/cache are settled, startup cost is zero. */
export const SWEEP_DELAY_MS = 15_000;

/** What a single sweep actually removed — the completion-log payload (zeros ⇒ nothing was stale). */
export interface SweepSummary {
	readonly pinsRemoved: number;
	readonly overridesRemoved: number;
	/** Orphaned local-pin docids dropped (a main key or a target). */
	readonly localPinsRemoved: number;
	/** False ⇒ the scan could not read every file, so NOTHING was dropped (see {@link OrphanSweeper.run}). */
	readonly everyFileRead: boolean;
}

/**
 * Delayed self-healing pass (step doc): warms the path↔docid map over all
 * eligible files, then drops exactly the orphans — pins, per-node overrides and
 * local pins whose docid no longer resolves. The scan itself is NOT this class's knowledge:
 * it is the one {@link DocIdMapWarmer} the read path uses (READ-ONLY `getDocId`,
 * chunked with yields, tolerant of an unreadable file). The judgment is pure
 * ({@link SweepPlanner}); what is left here is only the decision to DROP — and
 * that decision is skipped outright when the scan's evidence is incomplete.
 *
 * The docid-keyed persisted state now spans two stores: the GLOBAL pinned set in
 * `data.json` ({@link PluginDataStore}) and the per-doc/per-main facts —
 * overrides + local pins — as per-file vault content ({@link PerDocStore}).
 * Reconciling BOTH is the whole job: the per-file store's cache is warmed here so
 * the authoritative `per_file/` directory listing (an orphaned file whose doc is
 * gone) and the loaded mains' localPins (an orphaned target) both come into view.
 *
 * This is also the deferred cleanup path for unpin/override-clear and for
 * deletes that the live `vault.on('delete')` handler could not map to a docid.
 */
export class OrphanSweeper {
	constructor(
		private readonly docIdMapWarmer: DocIdMapWarmer,
		private readonly pathDocIdMap: PathDocIdMap,
		private readonly pluginDataStore: PluginDataStore,
		private readonly perDocStore: PerDocStore,
	) {}

	async run(): Promise<SweepSummary> {
		const scan = await this.docIdMapWarmer.warmAll();
		if (!scan.everyFileRead) {
			// A doc the scan could not READ is not evidence that the doc is GONE, and
			// this pass DELETES. Costing the user a pin over a transient read error is
			// the one outcome worth avoiding here: the map is warmed either way, the
			// live delete handler still prunes real deletions, and the next session
			// sweeps again.
			return { pinsRemoved: 0, overridesRemoved: 0, localPinsRemoved: 0, everyFileRead: false };
		}
		// Loads the per-file records so the sweep sees every stored override / local
		// pin (and, via the directory listing warm reads, every per-file file).
		await this.perDocStore.warm();
		const plan = SweepPlanner.plan({
			liveDocids: scan.liveDocids,
			pinnedDocids: this.pluginDataStore.pins().map((pin) => pin.docid),
			overrideDocids: this.perDocStore.overrideDocids(),
			localPinDocids: this.perDocStore.localPinDocids(),
		});
		return this.apply(plan);
	}

	private async apply(plan: SweepPlan): Promise<SweepSummary> {
		const pins = plan.pinsToRemove.filter((docid) => this.isConfirmedOrphan(docid));
		const overrides = plan.overridesToRemove.filter((docid) => this.isConfirmedOrphan(docid));
		const localPins = plan.localPinsToRemove.filter((docid) => this.isConfirmedOrphan(docid));
		const forgotten = new Set([...pins, ...overrides, ...localPins]);
		if (forgotten.size > 0) {
			// The two stores' forgetDocs together are the ONE conceptual choke point a
			// deleted doc spans (pinned set + per-file record + localPins targets); a
			// docid absent from either store is a no-op there.
			await this.pluginDataStore.forgetDocs([...forgotten]);
			await this.perDocStore.forgetDocs([...forgotten]);
		}
		return {
			pinsRemoved: pins.length,
			overridesRemoved: overrides.length,
			localPinsRemoved: localPins.length,
			everyFileRead: true,
		};
	}

	/**
	 * Drop-time re-verification: `liveDocids` is a SNAPSHOT from scan start —
	 * a doc created (and pinned) while the chunked warm-up was yielding would
	 * look orphaned. Every write intent maps its docid
	 * (PersistenceServices.withPersistableIdentity), so map presence at drop
	 * time means alive.
	 */
	private isConfirmedOrphan(docid: string): boolean {
		return this.pathDocIdMap.getPath(docid) === undefined;
	}
}
