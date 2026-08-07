import { describe, expect, it } from "vitest";
import { EngineDefaults, FakeLinkProvider, VicinityEngine } from "../engine";
import { GraphRequestAssembler } from "./GraphRequestAssembler";
import type { GraphRequestInputs } from "./GraphRequestAssembler";

/**
 * Owner decision 6 (ticket nid_2zm28ijiqp786yw6grwbvmffv_e): a locally pinned
 * note appears even with NO link from the main note — it is a pinned ROOT with
 * its own vicinity, exactly like a global pin. This is an ADAPTER-through-ENGINE
 * test on purpose: it proves the fact falls out of merging local pins into the
 * pinned-root list (the assembler) plus the engine's unchanged pinned-root
 * traversal — no engine change was needed.
 *
 * The "vault": MAIN a.md (linked to nothing relevant), an ISLAND b.md → c.md
 * disconnected from a.md, and a second note d.md that could be a different MAIN.
 */
function islandProvider(): FakeLinkProvider {
	return new FakeLinkProvider({
		files: [
			{ path: "a.md", sizeBytes: 100 },
			{ path: "island/b.md", sizeBytes: 100 },
			{ path: "island/c.md", sizeBytes: 100 },
			{ path: "d.md", sizeBytes: 100 },
		],
		links: {
			// b.md reaches c.md; NOTHING links a.md to the island.
			"island/b.md": ["island/c.md"],
		},
	});
}

const DOC_PATHS: Record<string, string> = {
	docid_a_e: "a.md",
	docid_b_e: "island/b.md",
	docid_d_e: "d.md",
};

function inputs(partial: Partial<GraphRequestInputs>): GraphRequestInputs {
	return {
		mainPath: "a.md",
		mainDocId: "docid_a_e",
		pins: [],
		localPins: [],
		nodeOverrides: {},
		resolveDocPath: (docid) => DOC_PATHS[docid],
		globalDepths: {
			...EngineDefaults.depthSettings(),
			// Pinned trio must reach the island's own neighbor to prove "its own vicinity".
			pinnedLinkDepthOut: 1,
			pinnedEmbedDepthOut: 1,
			pinnedLinkDepthIn: 1,
		},
		globalView: EngineDefaults.viewSettings(),
		nodeExclusion: EngineDefaults.nodeExclusionSettings(),
		...partial,
	};
}

function buildFor(partial: Partial<GraphRequestInputs>) {
	const request = GraphRequestAssembler.assemble(inputs(partial));
	return new VicinityEngine(islandProvider()).build(request);
}

function node(graph: ReturnType<typeof buildFor>, path: string) {
	return graph.nodes.find((candidate) => candidate.path === path);
}

describe("local pin of a note UNLINKED from the active main (owner decision 6)", () => {
	const LOCAL_PIN_B = { localPins: [{ docid: "docid_b_e", pinTimestamp: 1000 }] };

	it("WHEN B is locally pinned under main A and NOT linked from A THEN B is present as a pinned central", () => {
		const b = node(buildFor(LOCAL_PIN_B), "island/b.md");
		expect({ present: b !== undefined, isCentral: b?.isCentral, isMain: b?.isMain }).toEqual({
			present: true,
			isCentral: true,
			isMain: false,
		});
	});

	it("WHEN B is a locally pinned root THEN its OWN vicinity traverses (its neighbor C is pulled in)", () => {
		expect(node(buildFor(LOCAL_PIN_B), "island/c.md")).toBeDefined();
	});

	it("WHEN a DIFFERENT main is active (B not locally pinned there, no other reachability) THEN B does not appear", () => {
		// Local pins are keyed by MAIN docid — a different main carries none, so the
		// builder passes an empty localPins list for it.
		const graph = buildFor({ mainPath: "d.md", mainDocId: "docid_d_e", localPins: [] });
		expect(node(graph, "island/b.md")).toBeUndefined();
	});
});
