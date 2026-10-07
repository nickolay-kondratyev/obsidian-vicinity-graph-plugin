import { describe, expect, it } from "vitest";
import type { RelationshipName } from "../engine";
import { clearedRelationshipRecord, manualRelationshipRecord, parseRelationshipRecord } from "./relationshipRecord";
import type { RelationshipRecord } from "./relationshipRecord";

const CREATED = "2026-10-01T00:00:00.000Z";
const NOW = "2026-10-06T12:00:00.000Z";

const MANUAL: RelationshipRecord = { name: "supports", origin: "manual", createdIso: CREATED, updatedIso: CREATED };
const AI: RelationshipRecord = {
	name: "extends",
	origin: "ai",
	model: "gpt-6-luna",
	reasoningEffort: "medium",
	usage: { inputTokens: 1200, outputTokens: 40 },
	createdIso: CREATED,
	updatedIso: CREATED,
};
const DISMISSED: RelationshipRecord = { ...AI, name: null };

function name(value: string): RelationshipName {
	return value as RelationshipName;
}

describe("parseRelationshipRecord", () => {
	it("WHEN a manual record is read THEN it round-trips", () => {
		expect(parseRelationshipRecord(JSON.parse(JSON.stringify(MANUAL)))).toEqual(MANUAL);
	});

	it("WHEN an AI record is read THEN its model, effort and usage round-trip", () => {
		expect(parseRelationshipRecord(JSON.parse(JSON.stringify(AI)))).toEqual(AI);
	});

	it("WHEN a dismissed AI marker is read THEN its name stays null", () => {
		expect(parseRelationshipRecord(JSON.parse(JSON.stringify(DISMISSED)))?.name).toBeNull();
	});

	it("WHEN a MANUAL record has a null name THEN it reads as absent", () => {
		expect(parseRelationshipRecord({ ...MANUAL, name: null })).toBeNull();
	});

	it("WHEN the origin is unknown THEN the record reads as absent", () => {
		expect(parseRelationshipRecord({ ...MANUAL, origin: "syntax" })).toBeNull();
	});

	it("WHEN a timestamp is missing THEN the record reads as absent", () => {
		expect(parseRelationshipRecord({ name: "supports", origin: "manual", createdIso: CREATED })).toBeNull();
	});

	it("WHEN the payload is not an object THEN the record reads as absent", () => {
		expect(parseRelationshipRecord(["supports"])).toBeNull();
	});

	it("WHEN only the usage is malformed THEN the rest of the record survives without it", () => {
		expect(parseRelationshipRecord({ ...AI, usage: { inputTokens: "many" } })).toEqual({
			name: "extends",
			origin: "ai",
			model: "gpt-6-luna",
			reasoningEffort: "medium",
			createdIso: CREATED,
			updatedIso: CREATED,
		});
	});
});

describe("manualRelationshipRecord", () => {
	it("WHEN an unnamed pair is named THEN a manual record created now is returned", () => {
		expect(manualRelationshipRecord(undefined, name("supports"), NOW)).toEqual({
			name: "supports",
			origin: "manual",
			createdIso: NOW,
			updatedIso: NOW,
		});
	});

	it("WHEN an AI name is renamed THEN it becomes a manual record without the AI's details", () => {
		expect(manualRelationshipRecord(AI, name("refines"), NOW)).toEqual({
			name: "refines",
			origin: "manual",
			createdIso: CREATED,
			updatedIso: NOW,
		});
	});
});

describe("clearedRelationshipRecord", () => {
	it("WHEN a manual name is cleared THEN its file is deleted", () => {
		expect(clearedRelationshipRecord(MANUAL, NOW)).toEqual({ kind: "delete" });
	});

	it("WHEN an AI name is cleared THEN the dismissed marker is written", () => {
		expect(clearedRelationshipRecord(AI, NOW)).toEqual({ kind: "write", record: { ...AI, name: null, updatedIso: NOW } });
	});

	it("WHEN an already dismissed AI name is cleared THEN nothing changes", () => {
		expect(clearedRelationshipRecord(DISMISSED, NOW)).toEqual({ kind: "unchanged" });
	});

	it("WHEN a pair with nothing stored is cleared THEN nothing changes", () => {
		expect(clearedRelationshipRecord(undefined, NOW)).toEqual({ kind: "unchanged" });
	});
});
