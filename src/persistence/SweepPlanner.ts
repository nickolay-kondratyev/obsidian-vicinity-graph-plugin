/** Everything the sweep observed and needs to judge (all docid-keyed). */
export interface SweepInputs {
	/** Docids of docs that currently resolve in the vault (warm-up phase result). */
	readonly liveDocids: ReadonlySet<string>;
	/** Docids that have a `doc-data/<docid>.json` file. */
	readonly docDataDocids: readonly string[];
	/** Docids in the pinned set (data.json). */
	readonly pinnedDocids: readonly string[];
	/** Per LIVE doc-data owner: the central docids its `centralDepths` references. */
	readonly centralDocidsByOwner: ReadonlyMap<string, readonly string[]>;
}

/** Exactly what to drop — nothing else (test contract). */
export interface SweepPlan {
	readonly docDataToDelete: readonly string[];
	readonly pinsToRemove: readonly string[];
	/** Per surviving owner: the stale central docids to strip (only non-empty lists). */
	readonly staleCentralDocidsByOwner: ReadonlyMap<string, readonly string[]>;
}

/**
 * Pure orphan judgment (step doc): a doc-data file, a pin, or a
 * `centralDepths` entry is an orphan exactly when its docid no longer
 * resolves to a live doc. Effects live in `OrphanSweeper`.
 */
export class SweepPlanner {
	static plan(inputs: SweepInputs): SweepPlan {
		const staleCentralDocidsByOwner = new Map<string, readonly string[]>();
		for (const [owner, centralDocids] of inputs.centralDocidsByOwner) {
			const stale = centralDocids.filter((docid) => !inputs.liveDocids.has(docid));
			if (stale.length > 0) {
				staleCentralDocidsByOwner.set(owner, stale);
			}
		}
		return {
			docDataToDelete: inputs.docDataDocids.filter((docid) => !inputs.liveDocids.has(docid)),
			pinsToRemove: inputs.pinnedDocids.filter((docid) => !inputs.liveDocids.has(docid)),
			staleCentralDocidsByOwner,
		};
	}
}
