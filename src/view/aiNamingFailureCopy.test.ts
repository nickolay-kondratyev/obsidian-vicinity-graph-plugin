import { describe, expect, it } from "vitest";
import type { AiNamingFailure } from "../engine";
import { aiNamingFailureCopy } from "./aiNamingFailureCopy";

/** Every failure kind — a new one must be added here AND (compile error) in the copy table. */
const EVERY_FAILURE: readonly AiNamingFailure[] = [
	"no-key",
	"bad-key",
	"unknown-model",
	"rate-limited",
	"quota-exhausted",
	"rejected-request",
	"server-error",
	"network",
	"unexpected-response",
];

/** A bare HTTP status in user copy is exactly what the copy exists to avoid. */
const RAW_STATUS_CODE = /\b[1-5]\d\d\b/;

describe("aiNamingFailureCopy", () => {
	for (const failure of EVERY_FAILURE) {
		it(`WHEN naming fails with ${failure} THEN the copy shows no raw status code`, () => {
			expect(aiNamingFailureCopy(failure)).not.toMatch(RAW_STATUS_CODE);
		});
	}

	it("WHEN there is no key THEN the copy says to pick a key in settings", () => {
		expect(aiNamingFailureCopy("no-key")).toContain("Pick a key in the plugin settings");
	});

	it("WHEN there is no key THEN the copy explains desktop-started apps don't see OPENAI_API_KEY", () => {
		expect(aiNamingFailureCopy("no-key")).toContain("apps started from the desktop don't see shell variables");
	});

	it("WHEN the model is unknown THEN the copy points at the model setting", () => {
		expect(aiNamingFailureCopy("unknown-model")).toContain("Check the model name");
	});
});
