import { describe, expect, it } from "vitest";
import { DocDataStore } from "../persistence/DocDataStore";
import { FakeFileStorage } from "../persistence/FakeFileStorage";
import { FakePluginDataPort } from "../persistence/FakePluginDataPort";
import { PathDocIdMap } from "../persistence/PathDocIdMap";
import { PluginDataStore } from "../persistence/PluginDataStore";
import { CanvasParseCache } from "./CanvasParseCache";
import { FakeDocIdPort } from "./FakeDocIdPort";
import { FakeObsidianPorts } from "./FakeObsidianPorts";
import { NeighborhoodGraphBuilder } from "./NeighborhoodGraphBuilder";

/**
 * End-to-end over fakes: persisted pins + live vault → engine graph. Vault:
 * main.md → a.md (body link), pinned.md is a pinned island.
 */
async function builderFixture() {
	const ports = new FakeObsidianPorts({
		files: [{ path: "main.md" }, { path: "a.md" }, { path: "pinned.md" }],
		fileCaches: {
			"main.md": { links: [{ link: "a", position: { start: { offset: 0 } } }] },
		},
		resolutions: { a: "a.md" },
		resolvedLinks: { "main.md": { "a.md": 1 } },
		backlinks: { "a.md": ["main.md"] },
	});
	const docIdPort = new FakeDocIdPort({
		"main.md": "docid_main_e",
		"a.md": "docid_a_e",
		"pinned.md": "docid_pin_e",
	});
	const pluginDataStore = new PluginDataStore(new FakePluginDataPort());
	await pluginDataStore.init();
	await pluginDataStore.addPin("docid_pin_e", 5);
	const pathDocIdMap = new PathDocIdMap();
	pathDocIdMap.set("pinned.md", "docid_pin_e");
	const builder = new NeighborhoodGraphBuilder(
		ports.vault,
		ports.metadataCache,
		docIdPort,
		new CanvasParseCache(),
		pluginDataStore,
		new DocDataStore(new FakeFileStorage(), "doc-data"),
		pathDocIdMap,
	);
	return { builder, docIdPort, pathDocIdMap };
}

describe("NeighborhoodGraphBuilder", () => {
	it("WHEN the main path resolves THEN its node is the MAIN central of the graph", async () => {
		const { builder } = await builderFixture();
		const graph = (await builder.build("main.md"))?.graph;
		expect(graph?.nodes.find((node) => node.path === "main.md")?.isMain).toBe(true);
	});

	it("WHEN main links a note THEN the neighbor is walked into the graph", async () => {
		const { builder } = await builderFixture();
		const graph = (await builder.build("main.md"))?.graph;
		expect(graph?.nodes.some((node) => node.path === "a.md")).toBe(true);
	});

	it("WHEN a persisted pin resolves through the map THEN it appears as a non-main central", async () => {
		const { builder } = await builderFixture();
		const graph = (await builder.build("main.md"))?.graph;
		const pinnedNode = graph?.nodes.find((node) => node.path === "pinned.md");
		expect([pinnedNode?.isCentral, pinnedNode?.isMain]).toEqual([true, false]);
	});

	it("WHEN the main path does not resolve THEN there is no graph (null, no throw)", async () => {
		const { builder } = await builderFixture();
		expect(await builder.build("ghost.md")).toBeNull();
	});

	it("WHEN a graph is built THEN no ids are created (read path uses getDocId only)", async () => {
		const { builder, docIdPort } = await builderFixture();
		await builder.build("main.md");
		expect(docIdPort.ensureCalls).toBe(0);
	});

	it("WHEN the main doc is visited THEN the path→docid map learns it lazily", async () => {
		const { builder, pathDocIdMap } = await builderFixture();
		await builder.build("main.md");
		expect(pathDocIdMap.getDocId("main.md")).toBe("docid_main_e");
	});
});
