import { describe, expect, it } from "vitest";
import type { ReferencePort } from "./obsidianPorts";
import { ReferenceOrder } from "./ReferenceOrder";

function ref(link: string, offset: number): ReferencePort {
	return { link, position: { start: { offset } } };
}

describe("ReferenceOrder.orderedLinkTexts", () => {
	it("WHEN links and embeds interleave in the body THEN they are merged by start offset", () => {
		const ordered = ReferenceOrder.orderedLinkTexts({
			links: [ref("late-link", 30), ref("early-link", 5)],
			embeds: [ref("middle-embed", 10)],
		});
		expect(ordered).toEqual(["early-link", "middle-embed", "late-link"]);
	});

	it("WHEN frontmatter links exist THEN they come first (top of the file, no body offset)", () => {
		const ordered = ReferenceOrder.orderedLinkTexts({
			links: [ref("body-link", 0)],
			frontmatterLinks: [{ link: "property-link" }],
		});
		expect(ordered).toEqual(["property-link", "body-link"]);
	});

	it("WHEN the cache has no reference arrays at all THEN the order is empty", () => {
		expect(ReferenceOrder.orderedLinkTexts({})).toEqual([]);
	});
});
