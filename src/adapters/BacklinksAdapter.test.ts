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
});
