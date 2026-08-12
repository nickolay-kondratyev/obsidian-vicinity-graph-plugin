import { describe, expect, it } from "vitest";
import { FakeVaultFsPort } from "./FakeVaultFsPort";
import { PluginDataAdapter } from "./PluginDataAdapter";
import type { PluginDataIo } from "./PluginDataAdapter";
import { formatQuarantineTimestamp } from "./quarantineTimestamp";

// A renamed (non-`.obsidian`) config dir on purpose: the adapter treats this path as
// opaque, so the fixture doubles as proof it never assumes the default config folder.
const DATA_JSON = "my-config/plugins/vicinity-graph/data.json";
/** A fixed instant so the quarantine name is deterministic (never `Date.now()` in tests). */
const CLOCK_MS = 1_700_000_000_000;
const STAMP = formatQuarantineTimestamp(CLOCK_MS);

/** The plugin's parsed-JSON I/O half — irrelevant to the probe/quarantine, stubbed inert. */
const INERT_IO: PluginDataIo = {
	loadData: async () => undefined,
	saveData: async () => undefined,
};

function adapterOn(fs: FakeVaultFsPort, io: PluginDataIo = INERT_IO): PluginDataAdapter {
	return new PluginDataAdapter(io, fs, DATA_JSON, () => CLOCK_MS);
}

describe("PluginDataAdapter.readRawData", () => {
	it("WHEN data.json is present THEN its exact bytes are returned", async () => {
		const fs = new FakeVaultFsPort();
		await fs.write(DATA_JSON, "{ raw bytes <<<<<<< HEAD");
		expect(await adapterOn(fs).readRawData()).toBe("{ raw bytes <<<<<<< HEAD");
	});

	it("WHEN data.json is absent THEN null is returned (nothing to classify)", async () => {
		expect(await adapterOn(new FakeVaultFsPort()).readRawData()).toBeNull();
	});

	it("WHEN the raw read throws THEN null is returned (an unclassifiable transient)", async () => {
		const fs = new FakeVaultFsPort();
		await fs.write(DATA_JSON, "present");
		const throwingRead = Object.assign(fs, {
			read: async (): Promise<string> => {
				throw new Error("EACCES: permission denied");
			},
		});
		expect(await adapterOn(throwingRead).readRawData()).toBeNull();
	});
});

describe("PluginDataAdapter.quarantineData", () => {
	it("WHEN a corrupt data.json is quarantined THEN it is renamed to a .corrupt-<ts> sibling", async () => {
		const fs = new FakeVaultFsPort();
		await fs.write(DATA_JSON, "corrupt");
		await adapterOn(fs).quarantineData();
		expect(fs.files.get(`${DATA_JSON}.corrupt-${STAMP}`)).toBe("corrupt");
	});

	it("WHEN quarantined THEN the original data.json is gone (moved, not copied)", async () => {
		const fs = new FakeVaultFsPort();
		await fs.write(DATA_JSON, "corrupt");
		await adapterOn(fs).quarantineData();
		expect(fs.files.has(DATA_JSON)).toBe(false);
	});

	it("WHEN quarantined THEN the set-aside file's NAME is returned for the notice", async () => {
		const fs = new FakeVaultFsPort();
		await fs.write(DATA_JSON, "corrupt");
		expect(await adapterOn(fs).quarantineData()).toBe(`data.json.corrupt-${STAMP}`);
	});

	it("WHEN a quarantine target name already exists THEN a _2 sibling is used (no overwrite)", async () => {
		const fs = new FakeVaultFsPort();
		await fs.write(DATA_JSON, "corrupt");
		await fs.write(`${DATA_JSON}.corrupt-${STAMP}`, "an earlier quarantine");
		await adapterOn(fs).quarantineData();
		expect(fs.files.get(`${DATA_JSON}.corrupt-${STAMP}`)).toBe("an earlier quarantine");
		expect(fs.files.get(`${DATA_JSON}.corrupt-${STAMP}_2`)).toBe("corrupt");
	});
});
