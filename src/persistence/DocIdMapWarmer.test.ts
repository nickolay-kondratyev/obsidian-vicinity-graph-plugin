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
	const fakeDocIds = new FakeDocIdPort({ "a.md": "docid_a_e", "b.md": "docid_b_e", "c.md": "docid_c_e" });
	const docIdPort = new CountingDocIdPort(fakeDocIds);
	const pathDocIdMap = new PathDocIdMap();
	const warmer = new DocIdMapWarmer(ports.vault, docIdPort, pathDocIdMap);
	return { warmer, docIdPort, fakeDocIds, pathDocIdMap };
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

/**
 * A scan reads file CONTENT across yields, so a file can vanish (or turn
 * unreadable) mid-walk and its read REJECTS. The warm-up is an optimization
 * over state the sweep re-derives — it must degrade, never propagate.
 */
describe("DocIdMapWarmer when a file cannot be read", () => {
	it("WHEN a file read fails THEN the scan walks past it and still resolves the wanted docid", async () => {
		const { warmer, fakeDocIds, pathDocIdMap } = warmerFixture();
		fakeDocIds.markUnreadable("a.md");
		await warmer.warmFor(["docid_c_e"]);
		expect(pathDocIdMap.getPath("docid_c_e")).toBe("c.md");
	});

	it("WHEN the file holding the wanted docid cannot be read THEN warmFor still resolves (a build never fails on it)", async () => {
		const { warmer, fakeDocIds } = warmerFixture();
		fakeDocIds.markUnreadable("b.md");
		await expect(warmer.warmFor(["docid_b_e"])).resolves.toBeUndefined();
	});

	it("WHEN a scan could not read every file THEN a docid it did not find is NOT cached as a miss", async () => {
		const { warmer, docIdPort, fakeDocIds } = warmerFixture();
		fakeDocIds.markUnreadable("b.md");
		await warmer.warmFor(["docid_orphan_e"]);
		const callsAfterFirstScan = docIdPort.getDocIdCalls;
		await warmer.warmFor(["docid_orphan_e"]);
		expect(docIdPort.getDocIdCalls).toBeGreaterThan(callsAfterFirstScan);
	});

	/** The user-visible point of the rule above: a LIVE pin is not hidden for the session. */
	it("WHEN a transient read failure clears THEN the docid that file carries resolves on the next warm", async () => {
		const { warmer, fakeDocIds, pathDocIdMap } = warmerFixture();
		fakeDocIds.markUnreadable("b.md");
		await warmer.warmFor(["docid_b_e"]);
		fakeDocIds.markReadable("b.md");
		await warmer.warmFor(["docid_b_e"]);
		expect(pathDocIdMap.getPath("docid_b_e")).toBe("b.md");
	});
});

describe("DocIdMapWarmer.warmAll", () => {
	it("WHEN a full pass runs THEN every eligible file's docid lands in the map", async () => {
		const { warmer, pathDocIdMap } = warmerFixture();
		await warmer.warmAll();
		expect(pathDocIdMap.getDocId("c.md")).toBe("docid_c_e");
	});

	it("WHEN a full pass runs THEN it reports exactly the docids it found live", async () => {
		const { warmer } = warmerFixture();
		expect([...(await warmer.warmAll()).liveDocids]).toEqual(["docid_a_e", "docid_b_e", "docid_c_e"]);
	});

	it("WHEN a full pass reads every file THEN it reports COMPLETE evidence", async () => {
		const { warmer } = warmerFixture();
		expect((await warmer.warmAll()).everyFileRead).toBe(true);
	});

	it("WHEN a file read fails during a full pass THEN the other docids are still reported live", async () => {
		const { warmer, fakeDocIds } = warmerFixture();
		fakeDocIds.markUnreadable("b.md");
		expect([...(await warmer.warmAll()).liveDocids]).toEqual(["docid_a_e", "docid_c_e"]);
	});

	it("WHEN a file read fails during a full pass THEN it reports INCOMPLETE evidence (nothing may be deleted on it)", async () => {
		const { warmer, fakeDocIds } = warmerFixture();
		fakeDocIds.markUnreadable("b.md");
		expect((await warmer.warmAll()).everyFileRead).toBe(false);
	});
});
