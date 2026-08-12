import { describe, expect, it } from "vitest";
import { asVaultPath } from "../engine";
import type { FakeObsidianSpec } from "./FakeObsidianPorts";
import { FakeObsidianPorts } from "./FakeObsidianPorts";
import { FrontmatterIdIndex } from "./FrontmatterIdIndex";

/**
 * BDD coverage of the cache-only reverse index behind frontmatter-id links.
 * Frontmatter comes straight from {@link FakeObsidianSpec.fileCaches} — no vault
 * reads, mirroring the real cache-only build.
 */

function indexOver(spec: FakeObsidianSpec, rawFields = "deps, links"): FrontmatterIdIndex {
	const ports = new FakeObsidianPorts(spec);
	return new FrontmatterIdIndex(ports.vault, ports.metadataCache, () => rawFields);
}

/** A spec where OWNER owns `owner-id` and REFERRER's `deps` points at it. */
const RESOLVED_SPEC: FakeObsidianSpec = {
	files: [{ path: "owner.md" }, { path: "referrer.md" }],
	fileCaches: {
		"owner.md": { frontmatter: { id: "owner-id" } },
		"referrer.md": { frontmatter: { id: "referrer-id", deps: ["owner-id"] } },
	},
};

describe("FrontmatterIdIndex outgoing resolution", () => {
	it("WHEN a configured field lists an owned id THEN it resolves to the owning note", () => {
		const index = indexOver(RESOLVED_SPEC);
		expect(index.resolvedTargets(asVaultPath("referrer.md"))).toEqual(["owner.md"]);
	});

	it("WHEN the referencing value is a SCALAR (not a list) THEN it still resolves", () => {
		const index = indexOver({
			files: [{ path: "owner.md" }, { path: "referrer.md" }],
			fileCaches: {
				"owner.md": { frontmatter: { id: "owner-id" } },
				"referrer.md": { frontmatter: { deps: "owner-id" } },
			},
		});
		expect(index.resolvedTargets(asVaultPath("referrer.md"))).toEqual(["owner.md"]);
	});

	it("WHEN a quoted value arrives with surrounding whitespace THEN it is trimmed before matching", () => {
		const index = indexOver({
			files: [{ path: "owner.md" }, { path: "referrer.md" }],
			fileCaches: {
				"owner.md": { frontmatter: { id: "owner-id" } },
				"referrer.md": { frontmatter: { deps: ["  owner-id  "] } },
			},
		});
		expect(index.resolvedTargets(asVaultPath("referrer.md"))).toEqual(["owner.md"]);
	});

	it("WHEN a list mixes a string id with a NON-STRING THEN only the string is indexed", () => {
		const index = indexOver({
			files: [{ path: "owner.md" }, { path: "referrer.md" }],
			fileCaches: {
				"owner.md": { frontmatter: { id: "owner-id" } },
				// The number 42 is not an id we index (locked: strings only).
				"referrer.md": { frontmatter: { deps: ["owner-id", 42] } },
			},
		});
		expect(index.resolvedTargets(asVaultPath("referrer.md"))).toEqual(["owner.md"]);
	});

	it("WHEN a referenced id has no owning note THEN it is silently skipped", () => {
		const index = indexOver({
			files: [{ path: "referrer.md" }],
			fileCaches: { "referrer.md": { frontmatter: { deps: ["ghost-id"] } } },
		});
		expect(index.resolvedTargets(asVaultPath("referrer.md"))).toEqual([]);
	});

	it("WHEN a note references its OWN id THEN no self-edge is produced", () => {
		const index = indexOver({
			files: [{ path: "self.md" }],
			fileCaches: { "self.md": { frontmatter: { id: "self-id", deps: ["self-id"] } } },
		});
		expect(index.resolvedTargets(asVaultPath("self.md"))).toEqual([]);
	});

	it("WHEN the same target is referenced through two fields THEN it is emitted ONCE", () => {
		const index = indexOver({
			files: [{ path: "owner.md" }, { path: "referrer.md" }],
			fileCaches: {
				"owner.md": { frontmatter: { id: "owner-id" } },
				"referrer.md": { frontmatter: { deps: ["owner-id"], links: ["owner-id"] } },
			},
		});
		expect(index.resolvedTargets(asVaultPath("referrer.md"))).toEqual(["owner.md"]);
	});

	it("WHEN two notes claim the same id THEN the lexicographically smallest path wins", () => {
		const index = indexOver({
			files: [{ path: "b-owner.md" }, { path: "a-owner.md" }, { path: "referrer.md" }],
			fileCaches: {
				"b-owner.md": { frontmatter: { id: "dup-id" } },
				"a-owner.md": { frontmatter: { id: "dup-id" } },
				"referrer.md": { frontmatter: { deps: ["dup-id"] } },
			},
		});
		expect(index.resolvedTargets(asVaultPath("referrer.md"))).toEqual(["a-owner.md"]);
	});

	it("WHEN the configured field list is EMPTY THEN the index is inert", () => {
		const index = indexOver(RESOLVED_SPEC, "");
		expect(index.resolvedTargets(asVaultPath("referrer.md"))).toEqual([]);
	});
});

describe("FrontmatterIdIndex incoming resolution", () => {
	it("WHEN a note owns an id referenced elsewhere THEN its referrers come back", () => {
		const index = indexOver(RESOLVED_SPEC);
		expect(index.referrersOf(asVaultPath("owner.md"))).toEqual(["referrer.md"]);
	});

	it("WHEN a note owns no id THEN it has no id-ref referrers", () => {
		const index = indexOver(RESOLVED_SPEC);
		expect(index.referrersOf(asVaultPath("referrer.md"))).toEqual([]);
	});

	it("WHEN a note LOST a duplicate-id claim THEN it gets no phantom incoming edge", () => {
		const index = indexOver({
			files: [{ path: "b-owner.md" }, { path: "a-owner.md" }, { path: "referrer.md" }],
			fileCaches: {
				"b-owner.md": { frontmatter: { id: "dup-id" } },
				"a-owner.md": { frontmatter: { id: "dup-id" } },
				"referrer.md": { frontmatter: { deps: ["dup-id"] } },
			},
		});
		// b-owner lost the claim to a-owner, so it owns nothing here.
		expect(index.referrersOf(asVaultPath("b-owner.md"))).toEqual([]);
	});
});

describe("FrontmatterIdIndex occurrence counts", () => {
	it("WHEN a target is referenced from two fields THEN the occurrence count is two", () => {
		const index = indexOver({
			files: [{ path: "owner.md" }, { path: "referrer.md" }],
			fileCaches: {
				"owner.md": { frontmatter: { id: "owner-id" } },
				"referrer.md": { frontmatter: { deps: ["owner-id"], links: ["owner-id"] } },
			},
		});
		expect(index.occurrenceCount(asVaultPath("referrer.md"), asVaultPath("owner.md"))).toBe(2);
	});

	it("WHEN there is no id-ref between the pair THEN the occurrence count is zero", () => {
		const index = indexOver(RESOLVED_SPEC);
		expect(index.occurrenceCount(asVaultPath("owner.md"), asVaultPath("referrer.md"))).toBe(0);
	});
});

describe("FrontmatterIdIndex refresh", () => {
	it("WHEN frontmatter changes and the index is marked stale THEN the next query rebuilds", () => {
		// A mutable fileCaches so a later edit is visible through the same ports.
		const fileCaches: Record<string, { frontmatter: Record<string, unknown> }> = {
			"owner.md": { frontmatter: { id: "owner-id" } },
			"referrer.md": { frontmatter: { deps: [] as string[] } },
		};
		const ports = new FakeObsidianPorts({ files: [{ path: "owner.md" }, { path: "referrer.md" }], fileCaches });
		const index = new FrontmatterIdIndex(ports.vault, ports.metadataCache, () => "deps");
		expect(index.resolvedTargets(asVaultPath("referrer.md"))).toEqual([]);

		// WHEN the referrer starts pointing at the owner and the cache event fires.
		fileCaches["referrer.md"] = { frontmatter: { deps: ["owner-id"] } };
		index.markStale();

		expect(index.resolvedTargets(asVaultPath("referrer.md"))).toEqual(["owner.md"]);
	});

	it("WHEN the configured field list changes THEN the next query rebuilds against the new fields", () => {
		let rawFields = "links";
		const ports = new FakeObsidianPorts({
			files: [{ path: "owner.md" }, { path: "referrer.md" }],
			fileCaches: {
				"owner.md": { frontmatter: { id: "owner-id" } },
				"referrer.md": { frontmatter: { deps: ["owner-id"] } },
			},
		});
		const index = new FrontmatterIdIndex(ports.vault, ports.metadataCache, () => rawFields);
		// `links` is configured, not `deps`, so nothing resolves yet.
		expect(index.resolvedTargets(asVaultPath("referrer.md"))).toEqual([]);

		rawFields = "deps";
		expect(index.resolvedTargets(asVaultPath("referrer.md"))).toEqual(["owner.md"]);
	});
});
