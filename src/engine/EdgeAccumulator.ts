import type { GraphEdge, VaultPath } from "./types";

/**
 * Accumulates directed edges, deduplicating per (source, target) while
 * preserving first-insertion order (determinism). Shared by the traversal
 * collector and the induced-subgraph sweep of {@link EdgeVisibility} so the
 * dedupe-key knowledge lives in ONE place.
 */
export class EdgeAccumulator {
	private readonly keys = new Set<string>();
	private readonly list: GraphEdge[] = [];

	add(source: VaultPath, target: VaultPath): void {
		// NUL separator: vault paths may contain spaces but never NUL - key stays unambiguous.
		const key = `${source}\u0000${target}`;
		if (!this.keys.has(key)) {
			this.keys.add(key);
			this.list.push({ source, target });
		}
	}

	edges(): readonly GraphEdge[] {
		return this.list;
	}
}
