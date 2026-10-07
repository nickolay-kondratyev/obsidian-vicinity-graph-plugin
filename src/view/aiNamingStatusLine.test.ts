import { describe, expect, it } from "vitest";
import { aiNamingFailureCopy } from "./aiNamingFailureCopy";
import { aiNamingStatusLine } from "./aiNamingStatusLine";
import type { AiNamingStatus } from "./AiRelationshipQueue";

const IDLE: AiNamingStatus = {
	preparing: 0,
	inFlight: 0,
	runRequested: 0,
	runAnswered: 0,
	named: 0,
	declined: 0,
	failed: 0,
	inputTokens: 0,
	outputTokens: 0,
	lastFailure: null,
	stopped: false,
};

describe("aiNamingStatusLine", () => {
	it("WHEN requests are in flight THEN it says how many of this run are answered", () => {
		expect(aiNamingStatusLine({ ...IDLE, inFlight: 9, runRequested: 12, runAnswered: 3 }, true)).toEqual({
			kind: "busy",
			text: "Naming 3 of 12…",
		});
	});

	it("WHEN notes are still being read and nothing is in flight THEN it says naming has started", () => {
		expect(aiNamingStatusLine({ ...IDLE, preparing: 1 }, true)).toEqual({ kind: "busy", text: "Naming…" });
	});

	it("WHEN idle after naming THEN it sums the session's names and tokens", () => {
		expect(aiNamingStatusLine({ ...IDLE, named: 12, inputTokens: 11000, outputTokens: 345 }, true)).toEqual({
			kind: "idle",
			text: "Named 12 this session (≈11,345 tokens)",
		});
	});

	it("WHEN a fatal failure stopped auto mode THEN it shows the plain-language fix as a stop", () => {
		expect(aiNamingStatusLine({ ...IDLE, stopped: true, lastFailure: "no-key", failed: 1 }, true)).toEqual({
			kind: "stopped",
			text: aiNamingFailureCopy("no-key"),
		});
	});

	it("WHEN a transient failure is the latest news THEN it shows the copy as a problem", () => {
		expect(aiNamingStatusLine({ ...IDLE, lastFailure: "rate-limited", failed: 1 }, true)).toEqual({
			kind: "problem",
			text: aiNamingFailureCopy("rate-limited"),
		});
	});

	it("WHEN a transient failure happened but naming goes on THEN it shows the progress", () => {
		expect(aiNamingStatusLine({ ...IDLE, lastFailure: "rate-limited", inFlight: 1, runRequested: 1 }, true).kind).toBe(
			"busy",
		);
	});

	it("WHEN nothing happened and auto mode is on THEN it says nothing is named yet", () => {
		expect(aiNamingStatusLine(IDLE, true)).toEqual({ kind: "idle", text: "Nothing named yet this session." });
	});

	it("WHEN nothing happened and auto mode is off THEN it says AI naming is off", () => {
		expect(aiNamingStatusLine(IDLE, false)).toEqual({ kind: "idle", text: "AI naming is off." });
	});
});
