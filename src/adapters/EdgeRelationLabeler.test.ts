import { describe, expect, it } from "vitest";
import type { GraphEdge } from "../engine";
import { asVaultPath } from "../engine";
import { EdgeRelationLabeler } from "./EdgeRelationLabeler";
import { FakeObsidianPorts } from "./FakeObsidianPorts";
import type { CachedMetadataPort, ReferencePort } from "./obsidianPorts";

const SOURCE = "source.md";
const TARGET = "target.md";
const OTHER = "other.md";
const CANVAS = "board.canvas";

function linkEdge(source: string, target: string): GraphEdge {
	return { source: asVaultPath(source), target: asVaultPath(target), count: 1, kind: "link", hierarchy: false };
}

function hierarchyEdge(source: string, target: string): GraphEdge {
	return { source: asVaultPath(source), target: asVaultPath(target), count: 0, kind: "link", hierarchy: true };
}

/**
 * The cache a real Obsidian would build for `content`: every plain `[[x]]` lands
 * in `links` at its offset, every `![[x]]` in `embeds` (offset at the `!`). Link
 * text is the bare target name (resolved by {@link FakeObsidianPorts.resolutions}).
 */
function cacheFor(content: string): CachedMetadataPort {
	const links: ReferencePort[] = [];
	const embeds: ReferencePort[] = [];
	for (const match of content.matchAll(/!?\[\[([^\]]+)\]\]/gu)) {
		const reference = { link: match[1] ?? "", position: { start: { offset: match.index } } };
		(match[0].startsWith("!") ? embeds : links).push(reference);
	}
	return { links, embeds };
}

/** GIVEN a source note with `content`, linking (by bare name) into target/other; plus a canvas. */
function labelerOver(content: string, canvasContent = ""): EdgeRelationLabeler {
	const ports = new FakeObsidianPorts({
		files: [
			{ path: SOURCE, content },
			{ path: TARGET },
			{ path: OTHER },
			{ path: CANVAS, content: canvasContent },
		],
		fileCaches: { [SOURCE]: cacheFor(content) },
		resolutions: { target: TARGET, other: OTHER },
	});
	return new EdgeRelationLabeler(ports.vault, ports.metadataCache);
}

async function relationOf(content: string, edge = linkEdge(SOURCE, TARGET)): Promise<string | undefined> {
	const [labelled] = await labelerOver(content).label([edge]);
	return labelled?.relation;
}

describe("EdgeRelationLabeler", () => {
	it("WHEN the source names its link THEN the edge carries that relation", async () => {
		expect(await relationOf("uses::[[target]]")).toBe("uses");
	});

	it("WHEN the link is unlabelled THEN the edge carries no relation", async () => {
		expect(await relationOf("mentions [[target]]")).toBeUndefined();
	});

	it("WHEN several labelled links hit one target THEN the first in document order wins", async () => {
		expect(await relationOf("uses::[[target]] and later extends::[[target]]")).toBe("uses");
	});

	it("WHEN an unlabelled link precedes a labelled one THEN the labelled one still wins", async () => {
		expect(await relationOf("see [[target]], which this uses::[[target]]")).toBe("uses");
	});

	it("WHEN the only prefixed reference is an embed THEN there is no relation", async () => {
		expect(await relationOf("uses::![[target]] and [[target]]")).toBeUndefined();
	});

	it("WHEN the source is a canvas THEN its text is never parsed for relations", async () => {
		const canvasText = JSON.stringify({ nodes: [{ type: "text", text: "uses::[[target]]" }] });
		const [edge] = await labelerOver("", canvasText).label([linkEdge(CANVAS, TARGET)]);
		expect(edge?.relation).toBeUndefined();
	});

	it("WHEN the edge is pure hierarchy (no link) THEN it is returned untouched", async () => {
		const edge = hierarchyEdge(SOURCE, TARGET);
		const [labelled] = await labelerOver("uses::[[target]]").label([edge]);
		expect(labelled).toBe(edge);
	});

	it("WHEN a labelled link targets a note outside the edge set THEN no edge is affected", async () => {
		expect(await relationOf("uses::[[other]] and [[target]]")).toBeUndefined();
	});

	it("WHEN two edges leave one source THEN each gets its own target's relation", async () => {
		const edges = await labelerOver("uses::[[target]] extends::[[other]]").label([
			linkEdge(SOURCE, TARGET),
			linkEdge(SOURCE, OTHER),
		]);
		expect(edges.map((edge) => edge.relation)).toEqual(["uses", "extends"]);
	});
});
