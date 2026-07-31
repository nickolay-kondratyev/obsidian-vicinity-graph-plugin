import { describe, expect, it } from "vitest";
import { BacklinksAdapter } from "./BacklinksAdapter";
import { FakeObsidianPorts } from "./FakeObsidianPorts";
import type { VaultFilePort } from "./obsidianPorts";

describe("BacklinksAdapter.extractSourcePaths (shape tolerance)", () => {
	it("WHEN data is Map-shaped (current builds) THEN the map keys are the source paths", () => {
		const result = { data: new Map([["a.md", []], ["b.md", []]]) };
		expect(BacklinksAdapter.extractSourcePaths(result)).toEqual(["a.md", "b.md"]);
	});

	it("WHEN data is Record-shaped (older builds) THEN the record keys are the source paths", () => {
		expect(BacklinksAdapter.extractSourcePaths({ data: { "a.md": [], "b.md": [] } })).toEqual(["a.md", "b.md"]);
	});

	it("WHEN the result carries no recognizable data THEN null signals the fallback", () => {
		expect(BacklinksAdapter.extractSourcePaths({ unexpected: true })).toBeNull();
	});

	it("WHEN the result is not an object THEN null signals the fallback", () => {
		expect(BacklinksAdapter.extractSourcePaths(undefined)).toBeNull();
	});
});

describe("BacklinksAdapter.extractOccurrenceOffsets (shape tolerance)", () => {
	it("WHEN data is Map-shaped with positioned references THEN offsets are extracted per source", () => {
		const result = { data: new Map([["a.md", [{ position: { start: { offset: 7 } } }, { position: { start: { offset: 30 } } }]]]) };
		expect(BacklinksAdapter.extractOccurrenceOffsets(result)).toEqual(new Map([["a.md", [7, 30]]]));
	});

	it("WHEN data is Record-shaped with positioned references THEN offsets are extracted per source", () => {
		const result = { data: { "a.md": [{ position: { start: { offset: 12 } } }] } };
		expect(BacklinksAdapter.extractOccurrenceOffsets(result)).toEqual(new Map([["a.md", [12]]]));
	});

	it("WHEN a reference carries no readable position THEN it degrades to a null offset, not a throw", () => {
		const result = { data: new Map([["a.md", [{ unexpected: true }]]]) };
		expect(BacklinksAdapter.extractOccurrenceOffsets(result)).toEqual(new Map([["a.md", [null]]]));
	});

	it("WHEN a source's reference list is not an array THEN that source degrades to an empty offset list", () => {
		const result = { data: new Map([["a.md", "not-a-list"]]) };
		expect(BacklinksAdapter.extractOccurrenceOffsets(result)).toEqual(new Map([["a.md", []]]));
	});

	it("WHEN the result carries no recognizable data THEN null signals the fallback", () => {
		expect(BacklinksAdapter.extractOccurrenceOffsets({ unexpected: true })).toBeNull();
	});
});

// GIVEN fake metadata caches with and without the undocumented API
describe("BacklinksAdapter presence check and call-through", () => {
	const target: VaultFilePort = {
		path: "target.md",
		extension: "md",
		stat: { mtime: 0, size: 0 },
		parent: { path: "/" },
	};

	it("WHEN getBacklinksForFile exists THEN the adapter reports it available", () => {
		const ports = new FakeObsidianPorts({ files: [{ path: "target.md" }], backlinks: {} });
		expect(BacklinksAdapter.isAvailable(ports.metadataCache)).toBe(true);
	});

	it("WHEN getBacklinksForFile is absent THEN the adapter reports it unavailable", () => {
		const ports = new FakeObsidianPorts({ files: [{ path: "target.md" }] });
		expect(BacklinksAdapter.isAvailable(ports.metadataCache)).toBe(false);
	});

	it("WHEN the API exists THEN backlink source paths are extracted from its result", () => {
		const ports = new FakeObsidianPorts({
			files: [{ path: "target.md" }],
			backlinks: { "target.md": ["linker1.md", "linker2.md"] },
		});
		expect(BacklinksAdapter.backlinkSourcePaths(ports.metadataCache, target)).toEqual([
			"linker1.md",
			"linker2.md",
		]);
	});

	it("WHEN the API is absent THEN backlinkSourcePaths returns null (caller falls back)", () => {
		const ports = new FakeObsidianPorts({ files: [{ path: "target.md" }] });
		expect(BacklinksAdapter.backlinkSourcePaths(ports.metadataCache, target)).toBeNull();
	});

	it("WHEN the API exists with positioned references THEN per-source occurrence offsets are extracted", () => {
		const ports = new FakeObsidianPorts({
			files: [{ path: "target.md" }],
			backlinkOffsets: { "target.md": { "linker.md": [5, 42] } },
		});
		expect(BacklinksAdapter.backlinkOccurrenceOffsets(ports.metadataCache, target)).toEqual(
			new Map([["linker.md", [5, 42]]]),
		);
	});

	it("WHEN the API is absent THEN backlinkOccurrenceOffsets returns null (caller falls back)", () => {
		const ports = new FakeObsidianPorts({ files: [{ path: "target.md" }] });
		expect(BacklinksAdapter.backlinkOccurrenceOffsets(ports.metadataCache, target)).toBeNull();
	});
});
