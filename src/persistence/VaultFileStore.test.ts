import { describe, expect, it } from "vitest";
import { FakeUserNotices } from "../view/FakeUserNotices";
import { FakeVaultFsPort } from "./FakeVaultFsPort";
import { VaultFileStore } from "./VaultFileStore";

const ROOT = ".plugin_data/vicinity_graph";
const FIXED_INSTANT = Date.UTC(2026, 7, 9, 14, 32, 5); // → 2026-08-09T14-32-05
const QUARANTINE_TS = "2026-08-09T14-32-05";
const fixedClock = (): number => FIXED_INSTANT;

function makeStore(fs: FakeVaultFsPort = new FakeVaultFsPort(), notice?: FakeUserNotices): VaultFileStore {
	return new VaultFileStore(ROOT, fs, fixedClock, notice);
}

/** Records the order of mutating ops AND yields between them, so a missing serialisation shows as interleaving. */
class RecordingFakeVaultFsPort extends FakeVaultFsPort {
	readonly log: string[] = [];

	override async write(path: string, contents: string): Promise<void> {
		this.log.push(`write ${path} ${contents.replace(/\s+/g, "")}`);
		await Promise.resolve();
		return super.write(path, contents);
	}

	override async rename(oldPath: string, newPath: string): Promise<void> {
		this.log.push(`rename ${oldPath}`);
		await Promise.resolve();
		return super.rename(oldPath, newPath);
	}
}

/** Holds `write` for any path containing a registered substring until released — probes cross-key parallelism. */
class BlockableFakeVaultFsPort extends FakeVaultFsPort {
	private readonly gates = new Map<string, Promise<void>>();
	private readonly releasers = new Map<string, () => void>();

	block(substring: string): void {
		let release = (): void => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		this.gates.set(substring, gate);
		this.releasers.set(substring, release);
	}

	release(substring: string): void {
		this.releasers.get(substring)?.();
	}

	override async write(path: string, contents: string): Promise<void> {
		for (const [substring, gate] of this.gates) {
			if (path.includes(substring)) {
				await gate;
			}
		}
		return super.write(path, contents);
	}
}

describe("VaultFileStore", () => {
	it("WHEN a payload is written THEN the on-disk text is the v1 envelope", async () => {
		const fs = new FakeVaultFsPort();
		await makeStore(fs).write("per_file/a.json", { name: "alice" });
		const onDisk = fs.files.get(`${ROOT}/per_file/a.json`);
		expect(JSON.parse(onDisk ?? "")).toEqual({ v1: { name: "alice" } });
	});

	it("WHEN a written payload is re-read THEN the payload is returned unwrapped", async () => {
		const store = makeStore();
		await store.write("per_file/a.json", { name: "alice" });
		expect(await store.read("per_file/a.json")).toEqual({ name: "alice" });
	});

	it("WHEN a key was never written THEN read returns null", async () => {
		expect(await makeStore().read("per_file/missing.json")).toBeNull();
	});

	it("WHEN serialised THEN object keys are sorted for a diff-stable output", async () => {
		const fs = new FakeVaultFsPort();
		await makeStore(fs).write("per_file/a.json", { zed: 1, alpha: 2 });
		expect(fs.files.get(`${ROOT}/per_file/a.json`)).toBe(`{\n  "v1": {\n    "alpha": 2,\n    "zed": 1\n  }\n}`);
	});

	it("WHEN the parent dir is absent THEN write creates it", async () => {
		const fs = new FakeVaultFsPort();
		await makeStore(fs).write("per_file/a.json", { ok: true });
		expect(await fs.exists(`${ROOT}/per_file`)).toBe(true);
	});

	it("WHEN write is repeated THEN mkdir does not throw on the existing dir", async () => {
		const store = makeStore();
		await store.write("per_file/a.json", { n: 1 });
		await expect(store.write("per_file/b.json", { n: 2 })).resolves.toBeUndefined();
	});

	it("WHEN a file holds git conflict markers THEN read returns null", async () => {
		const fs = new FakeVaultFsPort();
		fs.files.set(`${ROOT}/per_file/a.json`, "<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> other");
		expect(await makeStore(fs).read("per_file/a.json")).toBeNull();
	});

	it("WHEN a file is unreadable THEN it is renamed to a *_malformed_<ts> sibling and the original is gone", async () => {
		const fs = new FakeVaultFsPort();
		fs.files.set(`${ROOT}/per_file/a.json`, "not json");
		await makeStore(fs).read("per_file/a.json");
		expect(await fs.exists(`${ROOT}/per_file/a.json`)).toBe(false);
		expect(await fs.exists(`${ROOT}/per_file/a${"_malformed_"}${QUARANTINE_TS}.json`)).toBe(true);
	});

	it("WHEN a file is quarantined THEN the user is told exactly once", async () => {
		const fs = new FakeVaultFsPort();
		const notices = new FakeUserNotices();
		fs.files.set(`${ROOT}/per_file/a.json`, "not json");
		await makeStore(fs, notices).read("per_file/a.json");
		expect(notices.messages).toHaveLength(1);
	});

	it("WHEN an object has no recognised version key THEN it is quarantined like malformed", async () => {
		const fs = new FakeVaultFsPort();
		fs.files.set(`${ROOT}/per_file/a.json`, JSON.stringify({ v2: { future: true } }));
		expect(await makeStore(fs).read("per_file/a.json")).toBeNull();
		expect(await fs.exists(`${ROOT}/per_file/a_malformed_${QUARANTINE_TS}.json`)).toBe(true);
	});

	it("WHEN the v1 payload is legitimately null THEN read returns null WITHOUT quarantining", async () => {
		const fs = new FakeVaultFsPort();
		fs.files.set(`${ROOT}/per_file/a.json`, JSON.stringify({ v1: null }));
		expect(await makeStore(fs).read("per_file/a.json")).toBeNull();
		expect(await fs.exists(`${ROOT}/per_file/a.json`)).toBe(true);
	});

	it("WHEN a quarantine target name already exists THEN a _2 suffix is used (no overwrite)", async () => {
		const fs = new FakeVaultFsPort();
		fs.files.set(`${ROOT}/per_file/a.json`, "not json");
		fs.files.set(`${ROOT}/per_file/a_malformed_${QUARANTINE_TS}.json`, "an earlier quarantine");
		await makeStore(fs).read("per_file/a.json");
		expect(fs.files.get(`${ROOT}/per_file/a_malformed_${QUARANTINE_TS}.json`)).toBe("an earlier quarantine");
		expect(await fs.exists(`${ROOT}/per_file/a_malformed_${QUARANTINE_TS}_2.json`)).toBe(true);
	});

	it("WHEN two writes to the SAME key race THEN the last-requested payload is the final on-disk content", async () => {
		const fs = new FakeVaultFsPort();
		const store = makeStore(fs);
		await Promise.all([store.write("per_file/a.json", { n: 1 }), store.write("per_file/a.json", { n: 2 })]);
		expect(JSON.parse(fs.files.get(`${ROOT}/per_file/a.json`) ?? "")).toEqual({ v1: { n: 2 } });
	});

	it("WHEN two writes to the SAME key race THEN neither interleaves (second waits for the first's rename)", async () => {
		const fs = new RecordingFakeVaultFsPort();
		const store = makeStore(fs);
		await Promise.all([store.write("per_file/a.json", { n: 1 }), store.write("per_file/a.json", { n: 2 })]);
		const firstRename = fs.log.indexOf(`rename ${ROOT}/per_file/a.json.tmp`);
		const secondWrite = fs.log.lastIndexOf(`write ${ROOT}/per_file/a.json.tmp {"v1":{"n":2}}`);
		expect(secondWrite).toBeGreaterThan(firstRename);
	});

	it("WHEN writes target DIFFERENT keys THEN a blocked write does not stall the other", async () => {
		const fs = new BlockableFakeVaultFsPort();
		const store = makeStore(fs);
		fs.block("alpha");
		const blocked = store.write("per_file/alpha.json", { n: 1 });
		await store.write("per_file/beta.json", { n: 2 }); // resolves though alpha is held
		expect(JSON.parse(fs.files.get(`${ROOT}/per_file/beta.json`) ?? "")).toEqual({ v1: { n: 2 } });
		fs.release("alpha");
		await blocked;
	});

	it("WHEN a crash left a .tmp sibling THEN reading the real key is unaffected", async () => {
		const fs = new FakeVaultFsPort();
		fs.files.set(`${ROOT}/per_file/a.json.tmp`, "half-written garbage");
		fs.files.set(`${ROOT}/per_file/a.json`, JSON.stringify({ v1: { n: 7 } }));
		expect(await makeStore(fs).read("per_file/a.json")).toEqual({ n: 7 });
	});

	it("WHEN listKeys is called THEN only immediate child files are returned (no malformed or tmp siblings)", async () => {
		const fs = new FakeVaultFsPort();
		fs.files.set(`${ROOT}/per_file/a.json`, JSON.stringify({ v1: {} }));
		fs.files.set(`${ROOT}/per_file/b.json`, JSON.stringify({ v1: {} }));
		fs.files.set(`${ROOT}/per_file/c_malformed_${QUARANTINE_TS}.json`, "set aside");
		fs.files.set(`${ROOT}/per_file/d.json.tmp`, "crash residue");
		fs.files.set(`${ROOT}/per_file/nested/deep.json`, JSON.stringify({ v1: {} }));
		expect((await makeStore(fs).listKeys("per_file")).sort()).toEqual(["per_file/a.json", "per_file/b.json"]);
	});

	it("WHEN listKeys targets an absent dir THEN it returns empty", async () => {
		expect(await makeStore().listKeys("per_file")).toEqual([]);
	});

	it("WHEN a key is removed THEN it no longer exists", async () => {
		const store = makeStore();
		await store.write("per_file/a.json", { n: 1 });
		await store.remove("per_file/a.json");
		expect(await store.exists("per_file/a.json")).toBe(false);
	});

	it("WHEN an absent key is removed THEN it is a no-op (no throw)", async () => {
		await expect(makeStore().remove("per_file/ghost.json")).resolves.toBeUndefined();
	});
});
