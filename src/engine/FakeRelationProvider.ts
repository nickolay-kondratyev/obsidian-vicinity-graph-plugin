import type { RelationProvider } from "./RelationProvider";
import type { VaultPath } from "./types";
import { asVaultPath } from "./types";

/**
 * Declarative rel-note fold fixtures — per source path, the rel-note NAME targets
 * (one entry per statement occurrence, so duplicates express multiplicity). Omitted
 * sources answer `[]`, like the real adapter.
 */
export interface FakeRelationSpec {
	readonly relNoteFolds?: Readonly<Record<string, readonly string[]>>;
}

/**
 * In-memory {@link RelationProvider} over declarative fixtures — the test-side
 * stand-in for the adapter's named-relationship index. The label half of a named
 * relationship rides {@link import("./FakeLinkProvider").FakeLinkProvider} (via
 * declared reference relations); this fake carries only the rel-note fold data, the
 * one thing that seam owns.
 */
export class FakeRelationProvider implements RelationProvider {
	constructor(private readonly spec: FakeRelationSpec) {}

	relNoteFolds(source: VaultPath): readonly VaultPath[] {
		return (this.spec.relNoteFolds?.[source] ?? []).map(asVaultPath);
	}
}
