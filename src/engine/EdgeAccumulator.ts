import type { DirectedLink, VaultPath } from "./types";

/**
 * Accumulates directed (source, target) pairs, deduplicating while preserving
 * first-insertion order (determinism). Shared by the traversal collector and
 * the induced-subgraph sweep of {@link EdgeVisibility} so the dedupe-key
 * knowledge lives in ONE place. Deliberately count-free: multi-root walks
 * revisit the same pair, so tallying here would over-count — multiplicity is
 * attached once, from provider truth, in {@link EdgeVisibility}.
 */
export class EdgeAccumulator {
	private readonly keys = new Set<string>();
	private readonly list: DirectedLink[] = [];

	add(source: VaultPath, target: VaultPath): void {
		// NUL separator: vault paths may contain spaces but never NUL - key stays unambiguous.
		const key = `${source}\u0000${target}`;
		if (!this.keys.has(key)) {
			this.keys.add(key);
			this.list.push({ source, target });
		}
	}

	edges(): readonly DirectedLink[] {
		return this.list;
	}
}
