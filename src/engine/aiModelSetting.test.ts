import { describe, expect, it } from "vitest";
import { settledAiModel } from "./aiModelSetting";
import { SETTINGS_SPEC } from "./SettingsSpec";

describe("settledAiModel", () => {
	it("WHEN the slug has surrounding spaces THEN it is stored trimmed", () => {
		expect(settledAiModel("  gpt-other \n")).toBe("gpt-other");
	});

	it("WHEN the slug is blank THEN it settles at the declared default", () => {
		expect(settledAiModel("   ")).toBe(SETTINGS_SPEC.relationships.model.default);
	});
});
