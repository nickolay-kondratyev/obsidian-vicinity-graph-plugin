import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THUMBNAIL_VISIBLE_MIN_NODE_PX } from "../engine";

/**
 * The thumbnail's visibility threshold is knowledge held TWICE: the stylesheet's
 * `@container (min-height: …)` decides when the thumbnail is painted, and
 * {@link THUMBNAIL_VISIBLE_MIN_NODE_PX} makes the engine size image-bearing nodes
 * tall enough to reach it. CSS cannot import a TS constant, so this guard reads
 * the stylesheet and fails the moment the two drift — a drift that would be
 * SILENT otherwise (the node would just quietly stop showing its image).
 *
 * Lives in `src/view/` because it parses a view asset; the engine stays pure.
 */

const STYLESHEET = join(dirname(fileURLToPath(import.meta.url)), "graph-view.css");
// A top-level container query and its body: the body ends at the first `}` in
// column 0, since every rule inside the block is indented.
const CONTAINER_QUERY = /@container \(min-height:\s*(\d+)px\)\s*\{\n([\s\S]*?)\n\}/g;
const REVEALS_THUMBNAIL = /\.vicinity-graph-node__thumbnail\s*\{[^}]*display:\s*block/;

/** Min-heights of the container queries that switch the thumbnail on. */
function thumbnailRevealThresholdsPx(): number[] {
	const css = readFileSync(STYLESHEET, "utf8");
	return [...css.matchAll(CONTAINER_QUERY)]
		.filter(([, , body]) => body !== undefined && REVEALS_THUMBNAIL.test(body))
		.map(([, minHeight]) => Number(minHeight));
}

describe("thumbnail density threshold", () => {
	it("WHEN scanning graph-view.css THEN exactly one container query reveals the thumbnail", () => {
		expect(thumbnailRevealThresholdsPx()).toHaveLength(1);
	});

	it("WHEN the stylesheet reveals the thumbnail THEN it does so at the engine's image-node floor", () => {
		expect(thumbnailRevealThresholdsPx()[0]).toBe(THUMBNAIL_VISIBLE_MIN_NODE_PX);
	});
});
