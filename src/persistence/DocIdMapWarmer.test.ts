import { describe, expect, it } from "vitest";
import { FakeDocIdPort } from "../adapters/FakeDocIdPort";
import { FakeObsidianPorts } from "../adapters/FakeObsidianPorts";
import type { DocIdPort, VaultFilePort } from "../adapters/obsidianPorts";
import { DocIdMapWarmer } from "./DocIdMapWarmer";
import { PathDocIdMap } from "./PathDocIdMap";

/** Wraps a {@link DocIdPort} to count `getDocId` calls (scan-cost assertions). */
class CountingDocIdPort implements DocIdPort {
	getDocIdCalls = 0;

	constructor(private readonly inner: DocIdPort) {}

	getDocId(file: VaultFilePort): Promise<string | null> {
		this.getDocIdCalls += 1;
		return this.inner.getDocId(file);
	}

	ensureDocId(file: VaultFilePort): Promise<string | null> {
		return this.inner.ensureDocId(file);
	}

	isEligible(file: VaultFilePort): boolean {
		return this.inner.isEligible(file);
	}
}

function warmerFixture() {
	const ports = new FakeObsidianPorts({
		files: [{ path: "a.md" }, { path: "b.md" }, { path: "c.md" }],
	});
	const docIdPort = new CountingDocIdPort(
		new FakeDocIdPort({ "a.md": "docid_a_e", "b.md": "docid_b_e", "c.md": "docid_c_e" }),
	);
	const pathDocIdMap = new PathDocIdMap();
	const warmer = new DocIdMapWarmer(ports.vault, docIdPort, pathDocIdMap);
	return { warmer, docIdPort, pathDocIdMap };
}

describe("DocIdMapWarmer", () => {
	it("WHEN a wanted docid is missing from the map THEN a scan resolves it", async () => {
		const { warmer, pathDocIdMap } = warmerFixture();
		await warmer.warmFor(["docid_b_e"]);
		expect(pathDocIdMap.getPath("docid_b_e")).toBe("b.md");
	});

	it("WHEN every wanted docid already resolves THEN no file is read at all", async () => {
		const { warmer, docIdPort, pathDocIdMap } = warmerFixture();
		pathDocIdMap.set("a.md", "docid_a_e");
		await warmer.warmFor(["docid_a_e"]);
		expect(docIdPort.getDocIdCalls).toBe(0);
	});

	it("WHEN the wanted docid is found mid-scan THEN the remaining files are not read (early exit)", async () => {
		const { warmer, docIdPort } = warmerFixture();
		await warmer.warmFor(["docid_a_e"]);
		expect(docIdPort.getDocIdCalls).toBe(1);
	});

	it("WHEN a full scan does not find a docid THEN a later warmFor for it does not rescan (miss is cached)", async () => {
		const { warmer, docIdPort } = warmerFixture();
		await warmer.warmFor(["docid_orphan_e"]);
		const callsAfterFirstScan = docIdPort.getDocIdCalls;
		await warmer.warmFor(["docid_orphan_e"]);
		expect(docIdPort.getDocIdCalls).toBe(callsAfterFirstScan);
	});

	it("WHEN a scan walks past files THEN their docids are learned too (free warm-up)", async () => {
		const { warmer, pathDocIdMap } = warmerFixture();
		await warmer.warmFor(["docid_c_e"]);
		expect(pathDocIdMap.getPath("docid_a_e")).toBe("a.md");
	});

	it("WHEN the map is warmed THEN no ids are created (read path uses getDocId only)", async () => {
		const ports = new FakeObsidianPorts({ files: [{ path: "a.md" }] });
		const fakeDocIds = new FakeDocIdPort({ "a.md": "docid_a_e" });
		const warmer = new DocIdMapWarmer(ports.vault, fakeDocIds, new PathDocIdMap());
		await warmer.warmFor(["docid_a_e"]);
		expect(fakeDocIds.ensureCalls).toBe(0);
	});
});
