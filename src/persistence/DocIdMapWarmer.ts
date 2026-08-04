import type { DocIdPort, VaultPort } from "../adapters/obsidianPorts";
import { SerialPromiseChain } from "../shared/SerialPromiseChain";
import { ChunkedWork } from "./ChunkedWork";
import type { PathDocIdMap } from "./PathDocIdMap";

/** Same politeness budget as the sweep warm-up ({@link OrphanSweeper}). */
const WARM_BATCH_SIZE = 20;

/**
 * ON-DEMAND path↔docid warm-up for the read path
 * (ticket nid_gbyqsuplz8b7pv0u5k34sdz1q_e): after a restart the in-memory
 * {@link PathDocIdMap} is cold, so persisted pins and per-node overrides —
 * both docid-keyed — resolve to no path and are invisible until the delayed
 * orphan sweep (~15s) warms the map. This class resolves exactly the docids a
 * build needs, so the FIRST graph render is already correct.
 *
 * Identity discipline: `getDocId` only — READ-ONLY, id-lib-legal — never
 * `ensureDocId` (same contract as {@link OrphanSweeper}).
 *
 * Cost shape:
 * - a docid already in the map costs NOTHING (no scan starts at all);
 * - a scan stops as soon as every wanted docid is found, and every docid it
 *   reads on the way is kept (free warm-up for later builds);
 * - a docid the full scan could NOT resolve is remembered as a miss, so an
 *   orphaned pin/override never forces a rescan on every rebuild — the sweep
 *   deletes it later. A miss is per-session on purpose: every write intent
 *   maps its own docid (PersistenceServices), so a live doc never gets stuck
 *   behind a cached miss.
 */
export class DocIdMapWarmer {
	private readonly unresolvedDocids = new Set<string>();
	/** Serialized scans: a concurrent rebuild waits, re-checks, and usually finds everything already mapped. */
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
		// `missing` is re-evaluated INSIDE the slot: a scan queued behind another
		// only reads files for docids its predecessor did not already resolve.
		return this.scans.run(() => this.scanFor(this.missing(docids)));
	}

	private missing(docids: readonly string[]): readonly string[] {
		return docids.filter(
			(docid) => this.pathDocIdMap.getPath(docid) === undefined && !this.unresolvedDocids.has(docid),
		);
	}

	private async scanFor(docids: readonly string[]): Promise<void> {
		if (docids.length === 0) {
			return;
		}
		const wanted = new Set(docids);
		const eligibleFiles = this.vault.getFiles().filter((file) => this.docIdPort.isEligible(file));
		await ChunkedWork.forEachChunkedUntil(
			eligibleFiles,
			WARM_BATCH_SIZE,
			async (file) => {
				const docid = await this.docIdPort.getDocId(file);
				if (docid !== null) {
					this.pathDocIdMap.set(file.path, docid);
					wanted.delete(docid);
				}
				return wanted.size === 0;
			},
			this.yieldBetweenBatches,
		);
		for (const docid of wanted) {
			this.unresolvedDocids.add(docid);
		}
	}
}
