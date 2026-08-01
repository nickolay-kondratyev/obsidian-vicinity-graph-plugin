import type { LinkOccurrence, LinkOccurrenceProvider, OutgoingLinkOccurrence } from "./LinkOccurrenceProvider";
import type { VaultPath } from "./types";

/** Declarative occurrence fixtures. Omitted paths answer empty, like the real adapter. */
export interface FakeOccurrenceSpec {
	/** Per source path: its outgoing occurrences, in document order. */
	readonly outgoing?: Readonly<Record<string, readonly OutgoingLinkOccurrence[]>>;
}

/**
 * In-memory {@link LinkOccurrenceProvider} for downstream (view-model / drawer)
 * tests — the occurrence-layer sibling of `FakeLinkProvider`. Mirrors the real
 * adapter's contract: unknown paths answer `[]`, and the edge-scoped query is
 * a filter over the outgoing occurrences, never separate fixture data.
 */
export class FakeLinkOccurrenceProvider implements LinkOccurrenceProvider {
	constructor(private readonly spec: FakeOccurrenceSpec) {}

	occurrencesBetween(source: VaultPath, target: VaultPath): Promise<readonly LinkOccurrence[]> {
		const outgoing = this.spec.outgoing?.[source] ?? [];
		return Promise.resolve(
			outgoing
				.filter((occurrence) => occurrence.targetPath === target)
				.map(({ offset, context }) => ({ offset, context })),
		);
	}
}
