import { directedLinkKey } from "./types";
import type { DirectedLink, VaultPath } from "./types";

/**
 * Accumulates directed (source, target) pairs, deduplicating while preserving
 * first-insertion order (determinism). Deliberately count-free: multi-root walks
 * revisit the same pair, so tallying here would over-count — multiplicity is
 * attached once, from provider truth, in {@link EdgeAssembly}.
 */
export class EdgeAccumulator {
	private readonly keys = new Set<string>();
	private readonly list: DirectedLink[] = [];

	add(source: VaultPath, target: VaultPath): void {
		const key = directedLinkKey(source, target);
		if (!this.keys.has(key)) {
			this.keys.add(key);
			this.list.push({ source, target });
		}
	}

	edges(): readonly DirectedLink[] {
		return this.list;
	}
}
