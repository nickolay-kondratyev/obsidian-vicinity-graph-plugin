import { describe, expect, it } from "vitest";
import type { DepthSettings, VicinityGraph } from "../engine";
import { asVaultPath, EngineDefaults, VicinityEngine } from "../engine";
import { CanvasParseCache } from "./CanvasParseCache";
import type { FakeObsidianSpec } from "./FakeObsidianPorts";
import { FakeObsidianPorts } from "./FakeObsidianPorts";
import { FolderNoteIndex } from "./FolderNoteIndex";
import { FrontmatterIdIndex } from "./FrontmatterIdIndex";
import { NamedRelationshipsIndex } from "./NamedRelationshipsIndex";
import { ObsidianLinkProvider } from "./ObsidianLinkProvider";

/** A ready index over `spec` — the initial scan awaited, queries then sync. */
async function indexOver(spec: FakeObsidianSpec): Promise<NamedRelationshipsIndex> {
	const ports = new FakeObsidianPorts(spec);
	const index = new NamedRelationshipsIndex(ports.vault, ports.metadataCache);
	await index.ensureReady();
	return index;
}

/** A cache entry whose only job is to open the scan gate (the entry itself is content-derived). */
const GATE_OPENING_CACHE = { links: [{ link: "x", position: { start: { offset: 0 } } }] };

describe("NamedRelationshipsIndex resolved named references", () => {
	it("WHEN a note carries a bare statement THEN its resolved target rides a label-bearing link reference", async () => {
		const index = await indexOver({
			files: [{ path: "a.md", content: "supports::[[B]]" }, { path: "b.md" }],
			fileCaches: { "a.md": GATE_OPENING_CACHE },
			resolutions: { B: "b.md" },
		});
		expect(index.namedReferences(asVaultPath("a.md"))).toEqual([
			{ target: "b.md", kind: "link", relations: [{ name: "supports" }] },
		]);
	});

	it("WHEN a statement's target is an embed THEN the reference keeps the embed kind", async () => {
		const index = await indexOver({
			files: [{ path: "a.md", content: "shows::![[Pic]]" }, { path: "pic.md" }],
			fileCaches: { "a.md": GATE_OPENING_CACHE },
			resolutions: { Pic: "pic.md" },
		});
		expect(index.namedReferences(asVaultPath("a.md"))[0]?.kind).toBe("embed");
	});

	it("WHEN a statement's target does not resolve THEN it contributes no reference (graceful degradation)", async () => {
		const index = await indexOver({
			files: [{ path: "a.md", content: "supports::[[Ghost]]" }],
			fileCaches: { "a.md": GATE_OPENING_CACHE },
		});
		expect(index.namedReferences(asVaultPath("a.md"))).toEqual([]);
	});

	it("WHEN a bracketed statement carries a qualifier THEN the label carries it too", async () => {
		const index = await indexOver({
			files: [{ path: "a.md", content: "[supports:: [[B]] but not strongly]" }, { path: "b.md" }],
			fileCaches: { "a.md": GATE_OPENING_CACHE },
			resolutions: { B: "b.md" },
		});
		expect(index.namedReferences(asVaultPath("a.md"))[0]?.relations).toEqual([
			{ name: "supports", qualifier: "but not strongly" },
		]);
	});

	it("WHEN a rel-note statement resolves THEN the label links the rel note (alias-else-basename name)", async () => {
		const index = await indexOver({
			files: [{ path: "a.md", content: "[[he supports]]::[[B]]" }, { path: "b.md" }, { path: "he supports.md" }],
			fileCaches: { "a.md": GATE_OPENING_CACHE },
			resolutions: { "he supports": "he supports.md", B: "b.md" },
		});
		expect(index.namedReferences(asVaultPath("a.md"))[0]?.relations).toEqual([
			{ name: "he supports", relNoteTarget: "he supports.md" },
		]);
	});

	it("WHEN the changed handler delivers new content THEN queries answer from it (no re-read)", async () => {
		const index = await indexOver({
			files: [{ path: "a.md", content: "supports::[[B]]" }, { path: "b.md" }, { path: "c.md" }],
			fileCaches: { "a.md": GATE_OPENING_CACHE },
			resolutions: { B: "b.md", C: "c.md" },
		});
		index.handleFileChanged("a.md", "refutes::[[C]]");
		expect(index.namedReferences(asVaultPath("a.md"))).toEqual([
			{ target: "c.md", kind: "link", relations: [{ name: "refutes" }] },
		]);
	});
});

describe("NamedRelationshipsIndex rel-note folds (RelationProvider port)", () => {
	it("WHEN two statements name the same rel note THEN it folds once per occurrence", async () => {
		const index = await indexOver({
			files: [
				{ path: "a.md", content: "[[he supports]]::[[B]]\n[[he supports]]::[[C]]" },
				{ path: "b.md" },
				{ path: "c.md" },
				{ path: "he supports.md" },
			],
			fileCaches: { "a.md": GATE_OPENING_CACHE },
			resolutions: { "he supports": "he supports.md", B: "b.md", C: "c.md" },
		});
		expect(index.relNoteFolds(asVaultPath("a.md"))).toEqual(["he supports.md", "he supports.md"]);
	});

	it("WHEN a statement's name is plain text THEN it folds nothing", async () => {
		const index = await indexOver({
			files: [{ path: "a.md", content: "supports::[[B]]" }, { path: "b.md" }],
			fileCaches: { "a.md": GATE_OPENING_CACHE },
			resolutions: { B: "b.md" },
		});
		expect(index.relNoteFolds(asVaultPath("a.md"))).toEqual([]);
	});
});

// --- The ticket repro (nid_3s47jew297bthxajy1v288hiu_e), full adapter stack ---

/** Every depth 0, so the graph's reach is attributable to the ONE dial a test turns. */
const ZERO_DEPTHS: DepthSettings = {
	linkDepthOut: 0,
	embedDepthOut: 0,
	linkDepthIn: 0,
	namedDepthOut: 0,
	namedDepthIn: 0,
	descendantDepth: 0,
	ancestorDepth: 0,
	pinnedLinkDepthOut: 0,
	pinnedEmbedDepthOut: 0,
	pinnedLinkDepthIn: 0,
	pinnedNamedDepthOut: 0,
	pinnedNamedDepthIn: 0,
	pinnedDescendantDepth: 0,
	pinnedAncestorDepth: 0,
};

/** A.md --supports--> B.md --supports--> C.md, exactly the ticket's vault. */
const TICKET_SPEC: FakeObsidianSpec = {
	files: [
		{ path: "A.md", content: "supports::[[B]]" },
		{ path: "B.md", content: "supports::[[C]]" },
		{ path: "C.md" },
	],
	fileCaches: {
		"A.md": { links: [{ link: "B", position: { start: { offset: 10 } } }] },
		"B.md": { links: [{ link: "C", position: { start: { offset: 10 } } }] },
	},
	resolutions: { B: "B.md", C: "C.md" },
	resolvedLinks: { "A.md": { "B.md": 1 }, "B.md": { "C.md": 1 } },
};

async function ticketGraphAt(depthOverrides: Partial<DepthSettings>): Promise<VicinityGraph> {
	const ports = new FakeObsidianPorts(TICKET_SPEC);
	const namedRelations = new NamedRelationshipsIndex(ports.vault, ports.metadataCache);
	const provider = await ObsidianLinkProvider.create(
		ports.vault,
		ports.metadataCache,
		new CanvasParseCache(),
		new FrontmatterIdIndex(ports.vault, ports.metadataCache, () => ""),
		new FolderNoteIndex(ports.vault),
		namedRelations,
	);
	return new VicinityEngine(provider, namedRelations).build({
		main: { path: asVaultPath("A.md") },
		globalDepths: { ...ZERO_DEPTHS, ...depthOverrides },
		globalView: EngineDefaults.viewSettings(),
	});
}

describe("named links traverse under the named budget through the REAL adapter stack (ticket repro)", () => {
	it("WHEN the named-out depth is 2 THEN C is reached through two named hops", async () => {
		const graph = await ticketGraphAt({ namedDepthOut: 2 });
		expect(graph.nodes.map((node) => node.path).sort()).toEqual(["A.md", "B.md", "C.md"]);
	});

	it("WHEN A names B THEN the walked edge carries the label", async () => {
		const graph = await ticketGraphAt({ namedDepthOut: 1 });
		const edge = graph.edges.find((candidate) => candidate.source === "A.md" && candidate.target === "B.md");
		expect(edge?.relations).toEqual([{ name: "supports" }]);
	});

	it("WHEN a named link is also a plain link THEN the provider serves ONE reference carrying the label", async () => {
		const ports = new FakeObsidianPorts(TICKET_SPEC);
		const namedRelations = new NamedRelationshipsIndex(ports.vault, ports.metadataCache);
		const provider = await ObsidianLinkProvider.create(
			ports.vault,
			ports.metadataCache,
			new CanvasParseCache(),
			new FrontmatterIdIndex(ports.vault, ports.metadataCache, () => ""),
			new FolderNoteIndex(ports.vault),
			namedRelations,
		);
		expect(provider.getOutgoingReferences(asVaultPath("A.md"))).toEqual([
			{ target: "B.md", kind: "link", relations: [{ name: "supports" }] },
		]);
	});
});
