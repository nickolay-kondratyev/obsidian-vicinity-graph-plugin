import { describe, expect, it } from "vitest";
import { EngineDefaults, asVaultPath } from "../engine";
import { DocDataMutations } from "../persistence/DocDataMutations";
import type { DocData } from "../persistence/persistedShapes";
import { PERSISTED_SHAPE_VERSION, PersistedShapes } from "../persistence/persistedShapes";
import type { GraphRequestInputs } from "./GraphRequestAssembler";
import { GraphRequestAssembler } from "./GraphRequestAssembler";

/**
 * Scenario §11.5(a): a pinned central X's depth, adjusted while MAIN is Y, must
 * round-trip through REAL {@link DocDataMutations} + the assembler and land on
 * X's per-root override ONLY while Y is main — never mutating X's own saved
 * DocData. Uses real mutation code (no persistence mocks): the mutation writes
 * Y's `centralDepths`, the assembler merges `{...Xown, ...Y.centralDepths[X]}`.
 */

const X_DOCID = "docid_x_e";
const X_PATH = "notes/x.md";

/** X's OWN persisted override (as if X had been visited as MAIN earlier). */
const X_OWN: DocData = { version: PERSISTED_SHAPE_VERSION, depths: { outgoingDepth: 5 } };

function inputs(mainPath: string, mainDocData: DocData): GraphRequestInputs {
	return {
		mainPath,
		mainDocId: `docid_${mainPath.replace(/\W/g, "_")}`,
		mainPersistable: true,
		mainDocData,
		pins: [{ docid: X_DOCID, pinTimestamp: 1 }],
		resolvePinPath: (docid) => (docid === X_DOCID ? X_PATH : undefined),
		docDataByDocid: new Map([[X_DOCID, X_OWN]]),
		globalDepths: EngineDefaults.depthSettings(),
		globalView: EngineDefaults.viewSettings(),
		nodeExclusion: EngineDefaults.nodeExclusionSettings(),
	};
}

function xOverrideAtMain(mainPath: string, mainDocData: DocData) {
	return GraphRequestAssembler.assemble(inputs(mainPath, mainDocData)).depthOverridesByRoot?.get(asVaultPath(X_PATH));
}

describe("central-depth round-trip through DocDataMutations + assembler", () => {
	const xOwnBefore = JSON.stringify(X_OWN);

	// Y adjusts X's depth to {3,3} via the real mutation primitive.
	let yDoc = PersistedShapes.emptyDocData();
	yDoc = DocDataMutations.setCentralDepthField(yDoc, X_DOCID, "outgoingDepth", 3);
	yDoc = DocDataMutations.setCentralDepthField(yDoc, X_DOCID, "incomingDepth", 3);

	it("WHEN MAIN is Y THEN X's override is Y's adjustment merged over X's own (per-field)", () => {
		expect(xOverrideAtMain("y.md", yDoc)).toEqual({ outgoingDepth: 3, incomingDepth: 3 });
	});

	it("WHEN MAIN is Z (never adjusted X) THEN X falls back to its OWN saved override only", () => {
		expect(xOverrideAtMain("z.md", PersistedShapes.emptyDocData())).toEqual({ outgoingDepth: 5 });
	});

	it("WHEN MAIN returns to Y THEN X's override is restored exactly (deterministic)", () => {
		expect(xOverrideAtMain("y.md", yDoc)).toEqual({ outgoingDepth: 3, incomingDepth: 3 });
	});

	it("WHEN X's depth is adjusted at Y THEN X's OWN DocData is byte-identical throughout", () => {
		xOverrideAtMain("y.md", yDoc);
		xOverrideAtMain("z.md", PersistedShapes.emptyDocData());
		expect(JSON.stringify(X_OWN)).toBe(xOwnBefore);
	});
});
