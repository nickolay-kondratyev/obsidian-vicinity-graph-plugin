import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import type { GraphRequestInputs } from "../adapters/GraphRequestAssembler";
import { PERSISTED_SHAPE_VERSION } from "../persistence/persistedShapes";
import type { CentralControl } from "./ControlsModel";
import { ControlsModelBuilder } from "./ControlsModel";

const PIN_PATHS: Record<string, string> = { docid_x_e: "notes/x.md" };

function inputs(partial: Partial<GraphRequestInputs> = {}): GraphRequestInputs {
	return {
		mainPath: "folder/main.md",
		mainDocId: "docid_main_e",
		mainPersistable: true,
		mainDocData: null,
		pins: [],
		resolvePinPath: (docid) => PIN_PATHS[docid],
		docDataByDocid: new Map(),
		globalDepths: { outgoingDepth: 2, incomingDepth: 1 },
		globalView: EngineDefaults.viewSettings(),
		...partial,
	};
}

function mainRow(partial: Partial<GraphRequestInputs> = {}): CentralControl {
	return ControlsModelBuilder.build(inputs(partial)).centrals[0]!;
}

function pinnedRow(partial: Partial<GraphRequestInputs>): CentralControl | undefined {
	return ControlsModelBuilder.build(inputs(partial)).centrals.find((central) => central.kind === "pinned");
}

const PIN_X = { pins: [{ docid: "docid_x_e", pinTimestamp: 1 }] } satisfies Partial<GraphRequestInputs>;

describe("ControlsModelBuilder MAIN row inherited-vs-pinned", () => {
	it("WHEN MAIN has no depth override THEN both directions inherit the global (not pinned)", () => {
		const main = mainRow();
		expect({ out: main.outgoing, in: main.incoming }).toEqual({
			out: { value: 2, pinned: false },
			in: { value: 1, pinned: false },
		});
	});

	it("WHEN MAIN pins one direction THEN only that direction is pinned; the other inherits", () => {
		const main = mainRow({ mainDocData: { version: PERSISTED_SHAPE_VERSION, depths: { outgoingDepth: 3 } } });
		expect({ out: main.outgoing, in: main.incoming }).toEqual({
			out: { value: 3, pinned: true },
			in: { value: 1, pinned: false },
		});
	});

	it("WHEN MAIN pins a value EQUAL to the global default THEN it still reads as pinned (presence, not value-diff)", () => {
		const main = mainRow({ mainDocData: { version: PERSISTED_SHAPE_VERSION, depths: { outgoingDepth: 2 } } });
		expect(main.outgoing).toEqual({ value: 2, pinned: true });
	});

	it("WHEN MAIN pins depth 0 THEN the zero value is honored and pinned", () => {
		const main = mainRow({ mainDocData: { version: PERSISTED_SHAPE_VERSION, depths: { outgoingDepth: 0 } } });
		expect(main.outgoing).toEqual({ value: 0, pinned: true });
	});
});

describe("ControlsModelBuilder pinned central inherited-vs-pinned (Q-A layer semantics)", () => {
	it("WHEN X has its OWN override but MAIN did not adjust it THEN value uses the own override yet reads inherited at MAIN", () => {
		const row = pinnedRow({
			...PIN_X,
			docDataByDocid: new Map([
				["docid_x_e", { version: PERSISTED_SHAPE_VERSION, depths: { outgoingDepth: 3 } }],
			]),
		});
		expect(row?.outgoing).toEqual({ value: 3, pinned: false });
	});

	it("WHEN MAIN adjusted X's depth over X's own THEN centralDepths wins per field and reads pinned", () => {
		const row = pinnedRow({
			...PIN_X,
			mainDocData: { version: PERSISTED_SHAPE_VERSION, centralDepths: { docid_x_e: { outgoingDepth: 2 } } },
			docDataByDocid: new Map([
				["docid_x_e", { version: PERSISTED_SHAPE_VERSION, depths: { outgoingDepth: 3 } }],
			]),
		});
		expect(row?.outgoing).toEqual({ value: 2, pinned: true });
	});

	it("WHEN neither X nor MAIN pinned the field THEN it inherits the global (not pinned)", () => {
		const row = pinnedRow(PIN_X);
		expect(row?.outgoing).toEqual({ value: 2, pinned: false });
	});
});

describe("ControlsModelBuilder central list", () => {
	it("WHEN there is a MAIN and a resolvable pin THEN MAIN comes first, then the pinned row", () => {
		const centrals = ControlsModelBuilder.build(inputs(PIN_X)).centrals;
		expect(centrals.map((central) => `${central.kind}:${central.path}`)).toEqual([
			"main:folder/main.md",
			"pinned:notes/x.md",
		]);
	});

	it("WHEN a pin's docid does not resolve THEN it is skipped", () => {
		const centrals = ControlsModelBuilder.build(
			inputs({ pins: [{ docid: "docid_ghost_e", pinTimestamp: 1 }] }),
		).centrals;
		expect(centrals.map((central) => central.kind)).toEqual(["main"]);
	});

	it("WHEN a pin resolves to the main doc THEN it is skipped (already central)", () => {
		const centrals = ControlsModelBuilder.build(
			inputs({ pins: [{ docid: "docid_main_e", pinTimestamp: 1 }], resolvePinPath: () => "folder/main.md" }),
		).centrals;
		expect(centrals.map((central) => central.kind)).toEqual(["main"]);
	});

	it("WHEN building THEN the MAIN title is its basename without extension", () => {
		expect(mainRow().title).toBe("main");
	});
});

describe("ControlsModelBuilder global context", () => {
	it("WHEN building THEN the model carries the current global depths + view (planSettingsWrite ctx / sizing seed)", () => {
		const view = EngineDefaults.viewSettings();
		const model = ControlsModelBuilder.build(inputs({ globalView: view }));
		expect({ depths: model.globalDepths, view: model.globalView }).toEqual({
			depths: { outgoingDepth: 2, incomingDepth: 1 },
			view,
		});
	});
});

describe("ControlsModelBuilder persistability", () => {
	it("WHEN MAIN has no docid THEN the row is not persistable and carries no docid", () => {
		const main = mainRow({ mainDocId: null, mainPersistable: false });
		expect({ persistable: main.persistable, docid: main.docid }).toEqual({ persistable: false, docid: undefined });
	});

	it("WHEN MAIN has an unsafe docid (not persistable) THEN the row is not persistable despite a non-null docid", () => {
		const main = mainRow({ mainDocId: "foreign.id", mainPersistable: false });
		expect({ persistable: main.persistable, docid: main.docid }).toEqual({ persistable: false, docid: undefined });
	});

	it("WHEN MAIN is persistable THEN it exposes its docid", () => {
		expect(mainRow().docid).toBe("docid_main_e");
	});
});
