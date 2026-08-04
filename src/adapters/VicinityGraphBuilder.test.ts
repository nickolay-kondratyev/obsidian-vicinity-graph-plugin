import { describe, expect, it } from "vitest";
import { DocIdMapWarmer } from "../persistence/DocIdMapWarmer";
import { FakePluginDataPort } from "../persistence/FakePluginDataPort";
import { PathDocIdMap } from "../persistence/PathDocIdMap";
import { PluginDataStore } from "../persistence/PluginDataStore";
import { CanvasParseCache } from "./CanvasParseCache";
import { FakeDocIdPort } from "./FakeDocIdPort";
import { FakeObsidianPorts } from "./FakeObsidianPorts";
import { VicinityGraphBuilder } from "./VicinityGraphBuilder";

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
	const builder = new VicinityGraphBuilder(
		ports.vault,
		ports.metadataCache,
		docIdPort,
		new CanvasParseCache(),
		pluginDataStore,
		pathDocIdMap,
		new DocIdMapWarmer(ports.vault, docIdPort, pathDocIdMap),
	);
	return { builder, docIdPort, pathDocIdMap, pluginDataStore };
}

describe("VicinityGraphBuilder", () => {
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

	it("WHEN a global exclusion pattern matches a neighbor THEN it is suppressed end-to-end and counted", async () => {
		const { builder, pluginDataStore } = await builderFixture();
		await pluginDataStore.saveNodeExclusion({ enabled: true, patterns: ["^a\\.md$"] });
		const result = await builder.build("main.md");
		expect({
			hasA: result?.graph.nodes.some((node) => node.path === "a.md") ?? true,
			count: result?.graph.excludedNodeCount,
			pillCount: result?.controls.excludedNodeCount,
		}).toEqual({ hasA: false, count: 1, pillCount: 1 });
	});

	it("WHEN exclusion is disabled THEN a matching pattern is a no-op (neighbor stays)", async () => {
		const { builder, pluginDataStore } = await builderFixture();
		await pluginDataStore.saveNodeExclusion({ enabled: false, patterns: ["^a\\.md$"] });
		const result = await builder.build("main.md");
		expect(result?.graph.nodes.some((node) => node.path === "a.md")).toBe(true);
	});
});

/**
 * Restart shape: data.json carries a pin AND a per-node override, but the
 * in-memory path↔docid map is COLD (nothing pre-warmed). The first build must
 * resolve both on demand instead of waiting for the delayed sweep
 * (ticket nid_gbyqsuplz8b7pv0u5k34sdz1q_e).
 */
async function coldMapFixture(options: { readonly unreadablePath?: string } = {}) {
	const ports = new FakeObsidianPorts({
		// `vanished.md` sits BEFORE the pinned island in scan order, so a test that
		// makes it unreadable proves the warm-up walks PAST a failed read.
		files: [{ path: "main.md" }, { path: "a.md" }, { path: "vanished.md" }, { path: "pinned.md" }],
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
		"vanished.md": "docid_vanished_e",
		"pinned.md": "docid_pin_e",
	});
	if (options.unreadablePath !== undefined) {
		docIdPort.markUnreadable(options.unreadablePath);
	}
	const pluginDataStore = new PluginDataStore(new FakePluginDataPort());
	await pluginDataStore.init();
	await pluginDataStore.addPin("docid_pin_e", 5);
	await pluginDataStore.saveNodeOverrideField("docid_a_e", {
		field: "sizePx",
		value: { widthPx: 320, heightPx: 180 },
	});
	const pathDocIdMap = new PathDocIdMap();
	const builder = new VicinityGraphBuilder(
		ports.vault,
		ports.metadataCache,
		docIdPort,
		new CanvasParseCache(),
		pluginDataStore,
		pathDocIdMap,
		new DocIdMapWarmer(ports.vault, docIdPort, pathDocIdMap),
	);
	return { builder, docIdPort };
}

describe("VicinityGraphBuilder with a cold docid map (restart shape)", () => {
	it("WHEN the map is cold THEN a persisted pin is a central on the FIRST build", async () => {
		const { builder } = await coldMapFixture();
		const graph = (await builder.build("main.md"))?.graph;
		expect(graph?.nodes.find((node) => node.path === "pinned.md")?.isCentral).toBe(true);
	});

	it("WHEN the map is cold THEN a persisted override reaches its node on the FIRST build", async () => {
		const { builder } = await coldMapFixture();
		const graph = (await builder.build("main.md"))?.graph;
		expect(graph?.nodes.find((node) => node.path === "a.md")?.override).toEqual({
			sizePx: { widthPx: 320, heightPx: 180 },
		});
	});

	it("WHEN the cold map is warmed on demand THEN no ids are created (read path stays read-only)", async () => {
		const { builder, docIdPort } = await coldMapFixture();
		await builder.build("main.md");
		expect(docIdPort.ensureCalls).toBe(0);
	});

	/**
	 * The warm-up reads file CONTENT across yields, so an unrelated file can
	 * vanish mid-scan and its read reject. That must cost nothing but that file:
	 * a graph is not allowed to fail (or lose its pin) over it.
	 */
	it("WHEN an unrelated file cannot be read mid-warm-up THEN the build still renders the persisted pin", async () => {
		const { builder } = await coldMapFixture({ unreadablePath: "vanished.md" });
		const graph = (await builder.build("main.md"))?.graph;
		expect(graph?.nodes.find((node) => node.path === "pinned.md")?.isCentral).toBe(true);
	});
});
