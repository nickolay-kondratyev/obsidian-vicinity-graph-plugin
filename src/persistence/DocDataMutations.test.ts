import { describe, expect, it } from "vitest";
import { DEFAULT_NODE_CAP, DEFAULT_OUTGOING_DEPTH } from "../engine";
import { DocDataMutations } from "./DocDataMutations";
import { PersistedShapes, PERSISTED_SHAPE_VERSION } from "./persistedShapes";

const empty = PersistedShapes.emptyDocData();

describe("DocDataMutations pin-on-toggle semantics", () => {
	it("WHEN a depth equal to the global default is explicitly set THEN it is still written (pinned)", () => {
		const doc = DocDataMutations.setDepthField(empty, "outgoingDepth", DEFAULT_OUTGOING_DEPTH);
		expect(doc.depths).toEqual({ outgoingDepth: DEFAULT_OUTGOING_DEPTH });
	});

	it("WHEN a view field equal to the global default is explicitly set THEN it is still written (pinned)", () => {
		const doc = DocDataMutations.setViewField(empty, "nodeCap", DEFAULT_NODE_CAP);
		expect(doc.view).toEqual({ nodeCap: DEFAULT_NODE_CAP });
	});

	it("WHEN one depth field is set THEN the other stays absent (per-field, never snapshots)", () => {
		const doc = DocDataMutations.setDepthField(empty, "incomingDepth", 3);
		expect(doc.depths?.outgoingDepth).toBeUndefined();
	});

	it("WHEN a field is set to undefined THEN it reverts to inherit (field removed)", () => {
		const pinnedBoth = DocDataMutations.setDepthField(
			DocDataMutations.setDepthField(empty, "outgoingDepth", 2),
			"incomingDepth",
			3,
		);
		const reverted = DocDataMutations.setDepthField(pinnedBoth, "outgoingDepth", undefined);
		expect(reverted.depths).toEqual({ incomingDepth: 3 });
	});

	it("WHEN the last pinned field is removed THEN the whole sub-object disappears", () => {
		const pinned = DocDataMutations.setViewField(empty, "groupByFolder", false);
		const reverted = DocDataMutations.setViewField(pinned, "groupByFolder", undefined);
		expect(reverted).toEqual({ version: PERSISTED_SHAPE_VERSION });
	});
});

describe("DocDataMutations.setCentralDepthField", () => {
	it("WHEN a central's depth is adjusted while this doc is MAIN THEN it lands under that central's docid", () => {
		const doc = DocDataMutations.setCentralDepthField(empty, "docid_c_e", "outgoingDepth", 2);
		expect(doc.centralDepths).toEqual({ docid_c_e: { outgoingDepth: 2 } });
	});

	it("WHEN a central's last field is removed THEN its entry disappears entirely", () => {
		const withCentral = DocDataMutations.setCentralDepthField(empty, "docid_c_e", "outgoingDepth", 2);
		const reverted = DocDataMutations.setCentralDepthField(withCentral, "docid_c_e", "outgoingDepth", undefined);
		expect(reverted.centralDepths).toBeUndefined();
	});
});

describe("DocDataMutations.withoutCentralDepths (sweep cleanup)", () => {
	it("WHEN stale central docids are dropped THEN the healthy entries survive", () => {
		const doc = DocDataMutations.setCentralDepthField(
			DocDataMutations.setCentralDepthField(empty, "docid_stale_e", "outgoingDepth", 2),
			"docid_ok_e",
			"incomingDepth",
			1,
		);
		expect(DocDataMutations.withoutCentralDepths(doc, ["docid_stale_e"]).centralDepths).toEqual({
			docid_ok_e: { incomingDepth: 1 },
		});
	});
});

describe("DocDataMutations.isEmpty", () => {
	it("WHEN nothing is pinned THEN the doc data is empty (store deletes the file)", () => {
		expect(DocDataMutations.isEmpty(empty)).toBe(true);
	});

	it("WHEN any field is pinned THEN the doc data is not empty", () => {
		expect(DocDataMutations.isEmpty(DocDataMutations.setDepthField(empty, "outgoingDepth", 1))).toBe(false);
	});
});
