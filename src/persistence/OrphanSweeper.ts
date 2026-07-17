import type { DocIdPort, VaultPort } from "../adapters/obsidianPorts";
import { ChunkedWork } from "./ChunkedWork";
import { DocDataMutations } from "./DocDataMutations";
import type { DocDataStore } from "./DocDataStore";
import type { PathDocIdMap } from "./PathDocIdMap";
import type { PluginDataStore } from "./PluginDataStore";
import { SweepPlanner } from "./SweepPlanner";

/** Sweep starts ~15s after plugin load (step doc) — vault/cache are settled, startup cost is zero. */
export const SWEEP_DELAY_MS = 15_000;
/** Items handled between main-thread yields; small enough that a batch is never felt. */
const SWEEP_BATCH_SIZE = 20;

/**
 * Delayed self-healing pass (step doc): warms the path↔docid map over all
 * eligible files (getDocId — READ-ONLY, never creates ids), then drops
 * exactly the orphans — doc-data files, pins and `centralDepths` entries
 * whose docid no longer resolves. All bulk phases are chunked with yields
 * ({@link ChunkedWork}); the judgment itself is pure ({@link SweepPlanner}).
 *
 * This is also the deferred cleanup path for unpin and for deletes that the
 * live `vault.on('delete')` handler could not map to a docid.
 */
export class OrphanSweeper {
	constructor(
		private readonly vault: VaultPort,
		private readonly docIdPort: DocIdPort,
		private readonly pathDocIdMap: PathDocIdMap,
		private readonly pluginDataStore: PluginDataStore,
		private readonly docDataStore: DocDataStore,
		private readonly yieldBetweenBatches: () => Promise<void> = ChunkedWork.sleepZero,
	) {}

	async run(): Promise<void> {
		const liveDocids = await this.warmMapAndCollectLiveDocids();
		const docDataDocids = await this.docDataStore.listDocIds();
		const plan = SweepPlanner.plan({
			liveDocids,
			docDataDocids,
			pinnedDocids: this.pluginDataStore.pins().map((pin) => pin.docid),
			centralDocidsByOwner: await this.collectCentralDocidsByOwner(docDataDocids, liveDocids),
		});
		await this.apply(plan.docDataToDelete, plan.pinsToRemove, plan.staleCentralDocidsByOwner);
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

	/** Reads each LIVE owner's doc-data to learn which centrals it references (orphan files get deleted whole). */
	private async collectCentralDocidsByOwner(
		docDataDocids: readonly string[],
		liveDocids: ReadonlySet<string>,
	): Promise<ReadonlyMap<string, readonly string[]>> {
		const centralDocidsByOwner = new Map<string, readonly string[]>();
		const liveOwners = docDataDocids.filter((docid) => liveDocids.has(docid));
		await this.forEachChunked(liveOwners, async (owner) => {
			const centralDepths = (await this.docDataStore.load(owner))?.centralDepths;
			if (centralDepths !== undefined) {
				centralDocidsByOwner.set(owner, Object.keys(centralDepths));
			}
		});
		return centralDocidsByOwner;
	}

	private async apply(
		docDataToDelete: readonly string[],
		pinsToRemove: readonly string[],
		staleCentralDocidsByOwner: ReadonlyMap<string, readonly string[]>,
	): Promise<void> {
		await this.forEachChunked(docDataToDelete, (docid) => this.docDataStore.remove(docid));
		if (pinsToRemove.length > 0) {
			// One data.json write for all stale pins — no reason to chunk a single call.
			await this.pluginDataStore.removePins(pinsToRemove);
		}
		await this.forEachChunked([...staleCentralDocidsByOwner], ([owner, staleCentralDocids]) =>
			this.docDataStore
				.update(owner, (doc) => DocDataMutations.withoutCentralDepths(doc, staleCentralDocids))
				.then(() => undefined),
		);
	}

	private forEachChunked<T>(items: readonly T[], work: (item: T) => void | Promise<void>): Promise<void> {
		return ChunkedWork.forEachChunked(items, SWEEP_BATCH_SIZE, work, this.yieldBetweenBatches);
	}
}
