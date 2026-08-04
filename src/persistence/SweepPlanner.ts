/** Everything the sweep observed and needs to judge (all docid-keyed). */
export interface SweepInputs {
	/** Docids of docs that currently resolve in the vault (warm-up phase result). */
	readonly liveDocids: ReadonlySet<string>;
	/** Docids in the pinned set (data.json). */
	readonly pinnedDocids: readonly string[];
	/** Docids in the per-node override map (data.json). */
	readonly overrideDocids: readonly string[];
}

/** Exactly what to drop — nothing else (test contract). */
export interface SweepPlan {
	readonly pinsToRemove: readonly string[];
	readonly overridesToRemove: readonly string[];
}

/**
 * Pure orphan judgment (step doc): an entry is an orphan exactly when its docid
 * no longer resolves to a live doc. Effects live in `OrphanSweeper`.
 *
 * Pins and per-node overrides are the ONLY docid-keyed persisted state —
 * `data.json`'s settings are global and not keyed by anything that can go stale.
 */
export class SweepPlanner {
	static plan(inputs: SweepInputs): SweepPlan {
		const isOrphan = (docid: string): boolean => !inputs.liveDocids.has(docid);
		return {
			pinsToRemove: inputs.pinnedDocids.filter(isOrphan),
			overridesToRemove: inputs.overrideDocids.filter(isOrphan),
		};
	}
}
