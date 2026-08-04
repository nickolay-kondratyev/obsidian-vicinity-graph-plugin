import type { DocIdPort, VaultPort } from "../adapters/obsidianPorts";
import { ChunkedWork } from "./ChunkedWork";
import type { PathDocIdMap } from "./PathDocIdMap";
import type { PluginDataStore } from "./PluginDataStore";
import { SweepPlanner } from "./SweepPlanner";

/** Sweep starts ~15s after plugin load (step doc) — vault/cache are settled, startup cost is zero. */
export const SWEEP_DELAY_MS = 15_000;
/** Items handled between main-thread yields; small enough that a batch is never felt. */
const SWEEP_BATCH_SIZE = 20;

/** What a single sweep actually removed — the completion-log payload (zeros ⇒ nothing was stale). */
export interface SweepSummary {
	readonly pinsRemoved: number;
	readonly overridesRemoved: number;
}

/**
 * Delayed self-healing pass (step doc): warms the path↔docid map over all
 * eligible files (getDocId — READ-ONLY, never creates ids), then drops exactly
 * the orphans — pins and per-node overrides whose docid no longer resolves. The
 * bulk warm-up is chunked with yields ({@link ChunkedWork}); the judgment
 * itself is pure ({@link SweepPlanner}).
 *
 * Pins and per-node overrides are the only docid-keyed persisted state
 * (settings are global-only since 2026-07-29), so pruning them is the whole job.
 *
 * This is also the deferred cleanup path for unpin/override-clear and for
 * deletes that the live `vault.on('delete')` handler could not map to a docid.
 */
export class OrphanSweeper {
	constructor(
		private readonly vault: VaultPort,
		private readonly docIdPort: DocIdPort,
		private readonly pathDocIdMap: PathDocIdMap,
		private readonly pluginDataStore: PluginDataStore,
		private readonly yieldBetweenBatches: () => Promise<void> = ChunkedWork.sleepZero,
	) {}

	async run(): Promise<SweepSummary> {
		const liveDocids = await this.warmMapAndCollectLiveDocids();
		const plan = SweepPlanner.plan({
			liveDocids,
			pinnedDocids: this.pluginDataStore.pins().map((pin) => pin.docid),
			overrideDocids: Object.keys(this.pluginDataStore.nodeOverrides()),
		});
		return this.apply(plan.pinsToRemove, plan.overridesToRemove);
	}

	private async warmMapAndCollectLiveDocids(): Promise<ReadonlySet<string>> {
		const liveDocids = new Set<string>();
		const eligibleFiles = this.vault.getFiles().filter((file) => this.docIdPort.isEligible(file));
		await this.forEachChunked(eligibleFiles, async (file) => {
			const docid = await this.docIdPort.getDocId(file);
			if (docid !== null) {
				this.pathDocIdMap.set(file.path, docid);
				liveDocids.add(docid);
			}
		});
		return liveDocids;
	}

	private async apply(pinsToRemove: readonly string[], overridesToRemove: readonly string[]): Promise<SweepSummary> {
		const confirmedPinsToRemove = pinsToRemove.filter((docid) => this.isConfirmedOrphan(docid));
		if (confirmedPinsToRemove.length > 0) {
			// One data.json write for all stale pins — no reason to chunk a single call.
			await this.pluginDataStore.removePins(confirmedPinsToRemove);
		}
		const confirmedOverridesToRemove = overridesToRemove.filter((docid) => this.isConfirmedOrphan(docid));
		if (confirmedOverridesToRemove.length > 0) {
			await this.pluginDataStore.removeNodeOverrides(confirmedOverridesToRemove);
		}
		return { pinsRemoved: confirmedPinsToRemove.length, overridesRemoved: confirmedOverridesToRemove.length };
	}

	/**
	 * Drop-time re-verification: `liveDocids` is a SNAPSHOT from warm-up start —
	 * a doc created (and pinned) while the chunked warm-up was yielding would
	 * look orphaned. Every write intent maps its docid
	 * (PersistenceServices.withPersistableIdentity), so map presence at drop
	 * time means alive.
	 */
	private isConfirmedOrphan(docid: string): boolean {
		return this.pathDocIdMap.getPath(docid) === undefined;
	}

	private forEachChunked<T>(items: readonly T[], work: (item: T) => void | Promise<void>): Promise<void> {
		return ChunkedWork.forEachChunked(items, SWEEP_BATCH_SIZE, work, this.yieldBetweenBatches);
	}
}
