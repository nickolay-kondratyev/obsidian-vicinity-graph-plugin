import { describe, expect, it } from "vitest";
import type { RelationshipName } from "../engine";
import { asVaultPath, directedLinkKey } from "../engine";
import { FakeVaultFsPort } from "./FakeVaultFsPort";
import { PathDocIdMap } from "./PathDocIdMap";
import { PathKeyedStoredRelationships } from "./PathKeyedStoredRelationships";
import { RelationshipStore } from "./RelationshipStore";
import { VaultFileStore } from "./VaultFileStore";

const ROOT = ".plugin_data/vicinity_graph";
const clock = (): number => Date.UTC(2026, 9, 6);

const A = asVaultPath("a.md");
const B = asVaultPath("b.md");
const SUPPORTS = "supports" as RelationshipName;

interface Harness {
	readonly store: RelationshipStore;
	readonly map: PathDocIdMap;
	readonly provider: PathKeyedStoredRelationships;
}

/** GIVEN a.md / b.md mapped to their docids and `docid_a_e → docid_b_e` named `supports`. */
async function namedHarness(): Promise<Harness> {
	const store = new RelationshipStore(new VaultFileStore(ROOT, new FakeVaultFsPort(), clock), clock);
	const map = new PathDocIdMap();
	map.set(A, "docid_a_e");
	map.set(B, "docid_b_e");
	await store.saveManualName("docid_a_e", "docid_b_e", SUPPORTS);
	return { store, map, provider: new PathKeyedStoredRelationships(store, map) };
}

describe("PathKeyedStoredRelationships", () => {
	it("WHEN a requested pair is named THEN it is answered under its path key", async () => {
		const { provider } = await namedHarness();
		const answered = await provider.storedRelationshipsFor([{ source: A, target: B }]);
		expect(answered.get(directedLinkKey(A, B))).toEqual({ name: "supports", origin: "manual" });
	});

	it("WHEN the REVERSE pair is requested THEN nothing is answered (directed)", async () => {
		const { provider } = await namedHarness();
		expect((await provider.storedRelationshipsFor([{ source: B, target: A }])).size).toBe(0);
	});

	it("WHEN a pair's path has no known docid THEN nothing is answered", async () => {
		const { provider } = await namedHarness();
		const unmapped = asVaultPath("c.md");
		expect((await provider.storedRelationshipsFor([{ source: A, target: unmapped }])).size).toBe(0);
	});

	it("WHEN a note was renamed THEN its stored name follows it (docid-keyed)", async () => {
		const { provider, map } = await namedHarness();
		const renamed = asVaultPath("renamed.md");
		map.handleRename(B, renamed);
		const answered = await provider.storedRelationshipsFor([{ source: A, target: renamed }]);
		expect(answered.get(directedLinkKey(A, renamed))?.name).toBe("supports");
	});
});
