import { describe, expect, it } from "vitest";
import { isFatalAiNamingFailure } from "./RelationshipNamer";
import type { AiNamingFailure } from "./RelationshipNamer";

describe("isFatalAiNamingFailure — which failures stop auto mode", () => {
	const table: readonly (readonly [AiNamingFailure, boolean])[] = [
		["no-key", true],
		["bad-key", true],
		["unknown-model", true],
		["quota-exhausted", true],
		["rejected-request", true],
		["rate-limited", false],
		["server-error", false],
		["network", false],
		["unexpected-response", false],
	];

	for (const [failure, fatal] of table) {
		it(`WHEN a request fails with ${failure} THEN it is ${fatal ? "fatal" : "not fatal"}`, () => {
			expect(isFatalAiNamingFailure(failure)).toBe(fatal);
		});
	}
});
