import type { DocIdPort, VaultPort } from "../adapters/obsidianPorts";
import { SerialPromiseChain } from "../shared/SerialPromiseChain";
import { ChunkedWork } from "./ChunkedWork";
import type { PathDocIdMap } from "./PathDocIdMap";

/** Files handled between main-thread yields; small enough that a batch is never felt. */
const WARM_BATCH_SIZE = 20;

/** What a full pass saw — {@link DocIdMapWarmer.warmAll}. */
export interface FullScanOutcome {
	/** Every docid the pass resolved: a snapshot, taken across the whole walk. */
	readonly liveDocids: ReadonlySet<string>;
	/**
	 * False when at least one file could not be READ. The live set is then
	 * INCOMPLETE evidence — a caller that deletes state for docids missing from
	 * it must not act on this pass (see {@link OrphanSweeper}).
	 */
	readonly everyFileRead: boolean;
}

/**
 * THE path↔docid scanner: the ONE place that walks eligible vault files asking
 * for their identity and fills {@link PathDocIdMap}. Two callers, two shapes —
 * {@link warmFor} (the read path: exactly the docids a build needs) and
 * {@link warmAll} (the delayed sweep, which also wants the live set). Keeping
 * both on one walk is what makes the read-only discipline, the politeness
 * budget and the read-failure policy below single facts.
 *
 * WHY the on-demand shape exists (ticket nid_gbyqsuplz8b7pv0u5k34sdz1q_e):
 * after a restart the in-memory map is cold, so persisted pins and per-node
 * overrides — both docid-keyed — resolve to no path and are invisible until the
 * delayed orphan sweep (~15s) warms the map. {@link warmFor} resolves exactly
 * the docids a build needs, so the FIRST graph render is already correct.
 *
 * Identity discipline: `getDocId` only — READ-ONLY, id-lib-legal — never
 * `ensureDocId`: a scan must not mint an id for a doc nobody wrote to.
 *
 * Cost shape:
 * - a docid already in the map costs NOTHING (no scan starts at all);
 * - a scan stops as soon as every wanted docid is found, and every docid it
 *   reads on the way is kept (free warm-up for later builds);
 * - a docid the full scan could NOT resolve is remembered as a miss, so an
 *   orphaned pin/override never forces a rescan on every rebuild — the sweep
 *   deletes it later. A miss is per-session on purpose: {@link missing} consults
 *   the MAP first and every write intent maps its own docid
 *   (PersistenceServices), so a live doc never gets stuck behind a cached miss.
 *
 * Failure policy: a scan NEVER rejects — a file it cannot READ is walked past
 * ({@link scanEligibleFiles}). The asymmetry that follows is deliberate: a MISS
 * is still cached (it only makes a doc invisible for the session, and any visit
 * or write intent undoes it), but a pass that missed a file says so
 * ({@link FullScanOutcome.everyFileRead}) because a caller that DELETES state
 * must never act on incomplete evidence.
 */
export class DocIdMapWarmer {
	private readonly unresolvedDocids = new Set<string>();
	/** Serialized scans: a concurrent rebuild (or the sweep) waits, re-checks, and usually finds everything already mapped. */
	private readonly scans = new SerialPromiseChain();

	constructor(
		private readonly vault: VaultPort,
		private readonly docIdPort: DocIdPort,
		private readonly pathDocIdMap: PathDocIdMap,
		private readonly yieldBetweenBatches: () => Promise<void> = ChunkedWork.sleepZero,
	) {}

	/** Resolves once every given docid is in the map, cached as a miss, or already known missed. */
	warmFor(docids: readonly string[]): Promise<void> {
		if (this.missing(docids).length === 0) {
			return Promise.resolve();
		}
		return this.scans.run(() => this.scanForMissing(docids));
	}

	/**
	 * Full pass: every eligible file's docid into the map, reporting the docids
	 * found LIVE and whether the pass actually READ every file. The set is a
	 * snapshot taken across the walk, which is why the sweep also re-verifies
	 * against the map before dropping anything.
	 */
	async warmAll(): Promise<FullScanOutcome> {
		const liveDocids = new Set<string>();
		let everyFileRead = true;
		await this.scans.run(async () => {
			everyFileRead = await this.scanEligibleFiles((docid) => {
				liveDocids.add(docid);
				return false;
			});
		});
		return { liveDocids, everyFileRead };
	}

	private async scanForMissing(docids: readonly string[]): Promise<void> {
		// `missing` is re-evaluated INSIDE the slot: a scan queued behind another
		// only reads files for docids its predecessor did not already resolve.
		const wanted = new Set(this.missing(docids));
		if (wanted.size === 0) {
			return;
		}
		await this.scanEligibleFiles((docid) => {
			wanted.delete(docid);
			return wanted.size === 0;
		});
		for (const docid of wanted) {
			this.unresolvedDocids.add(docid);
		}
	}

	private missing(docids: readonly string[]): readonly string[] {
		return docids.filter(
			(docid) => this.pathDocIdMap.getPath(docid) === undefined && !this.unresolvedDocids.has(docid),
		);
	}

	/**
	 * ONE walk shape for both callers: every eligible file, chunked with yields,
	 * each resolved docid mapped and then handed to `onDocId` — which returns
	 * `true` to stop the walk early. Resolves `false` when at least one file
	 * could not be READ.
	 *
	 * `getDocId` reads file content (`cachedRead`) and a walk spans yields, so a
	 * file can be deleted or turn unreadable between the `getFiles()` snapshot
	 * and its read. That is ONE file's identity and never the caller's problem: a
	 * graph build must still render and a sweep must still finish, so the walk
	 * continues past it — a warm-up is an optimization over state the sweep
	 * re-derives anyway.
	 */
	private async scanEligibleFiles(onDocId: (docid: string) => boolean): Promise<boolean> {
		const eligibleFiles = this.vault.getFiles().filter((file) => this.docIdPort.isEligible(file));
		let everyFileRead = true;
		await ChunkedWork.forEachChunkedUntil(
			eligibleFiles,
			WARM_BATCH_SIZE,
			async (file) => {
				let docid: string | null;
				try {
					docid = await this.docIdPort.getDocId(file);
				} catch (error: unknown) {
					console.warn(`vicinity-graph: docid warm-up could not read path=[${file.path}]`, error);
					everyFileRead = false;
					return false;
				}
				if (docid === null) {
					return false;
				}
				this.pathDocIdMap.set(file.path, docid);
				return onDocId(docid);
			},
			this.yieldBetweenBatches,
		);
		return everyFileRead;
	}
}
