/** Everything the sweep observed and needs to judge (all docid-keyed). */
export interface SweepInputs {
	/** Docids of docs that currently resolve in the vault (warm-up phase result). */
	readonly liveDocids: ReadonlySet<string>;
	/** Docids in the pinned set (data.json). */
	readonly pinnedDocids: readonly string[];
}

/** Exactly what to drop — nothing else (test contract). */
export interface SweepPlan {
	readonly pinsToRemove: readonly string[];
}

/**
 * Pure orphan judgment (step doc): a pin is an orphan exactly when its docid no
 * longer resolves to a live doc. Effects live in `OrphanSweeper`.
 *
 * Pins are the ONLY docid-keyed persisted state since settings became
 * global-only (2026-07-29) — `data.json`'s settings are not keyed by anything
 * that can go stale.
 */
export class SweepPlanner {
	static plan(inputs: SweepInputs): SweepPlan {
		return {
			pinsToRemove: inputs.pinnedDocids.filter((docid) => !inputs.liveDocids.has(docid)),
		};
	}
}
