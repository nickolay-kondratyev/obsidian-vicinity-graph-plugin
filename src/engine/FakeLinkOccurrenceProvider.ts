import type {
	BacklinkSourceOccurrences,
	LinkOccurrence,
	LinkOccurrenceProvider,
	OutgoingLinkOccurrence,
} from "./LinkOccurrenceProvider";
import type { VaultPath } from "./types";

/** Declarative occurrence fixtures. Omitted paths answer empty, like the real adapter. */
export interface FakeOccurrenceSpec {
	/** Per source path: its outgoing occurrences, in document order. */
	readonly outgoing?: Readonly<Record<string, readonly OutgoingLinkOccurrence[]>>;
	/** Per target path: its backlink groups. */
	readonly backlinks?: Readonly<Record<string, readonly BacklinkSourceOccurrences[]>>;
}

/**
 * In-memory {@link LinkOccurrenceProvider} for downstream (view-model / modal)
 * tests — the occurrence-layer sibling of `FakeLinkProvider`. Mirrors the real
 * adapter's contract: unknown paths answer `[]`, and the edge-scoped query is
 * a filter over the outgoing occurrences, never separate fixture data.
 */
export class FakeLinkOccurrenceProvider implements LinkOccurrenceProvider {
	constructor(private readonly spec: FakeOccurrenceSpec) {}

	outgoingOccurrences(path: VaultPath): Promise<readonly OutgoingLinkOccurrence[]> {
		return Promise.resolve(this.spec.outgoing?.[path] ?? []);
	}

	backlinkOccurrences(path: VaultPath): Promise<readonly BacklinkSourceOccurrences[]> {
		return Promise.resolve(this.spec.backlinks?.[path] ?? []);
	}

	async occurrencesBetween(source: VaultPath, target: VaultPath): Promise<readonly LinkOccurrence[]> {
		const outgoing = await this.outgoingOccurrences(source);
		return outgoing.filter((occurrence) => occurrence.targetPath === target);
	}
}
