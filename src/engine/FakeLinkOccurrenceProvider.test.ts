import { describe, expect, it } from "vitest";
import { FakeLinkOccurrenceProvider } from "./FakeLinkOccurrenceProvider";
import { asVaultPath } from "./types";

const NOTE = asVaultPath("note.md");
const TARGET = asVaultPath("target.md");
const OTHER = asVaultPath("other.md");

// GIVEN fixture occurrences: note.md → target.md twice, → other.md once.
const PROVIDER = new FakeLinkOccurrenceProvider({
	outgoing: {
		"note.md": [
			{ targetPath: TARGET, offset: 5, context: { shortContext: "a", expandedContext: "a", line: 0 } },
			{ targetPath: OTHER, offset: 9, context: null },
			{ targetPath: TARGET, offset: 20, context: null },
		],
	},
});

describe("FakeLinkOccurrenceProvider", () => {
	it("WHEN the edge scope names one target THEN only its occurrences answer (a filter, like the real adapter)", async () => {
		expect((await PROVIDER.occurrencesBetween(NOTE, TARGET)).map((occurrence) => occurrence.offset)).toEqual([
			5, 20,
		]);
	});

	it("WHEN a path is undeclared THEN the answer is empty, mirroring the real adapter", async () => {
		expect(await PROVIDER.occurrencesBetween(asVaultPath("missing.md"), TARGET)).toEqual([]);
	});
});
