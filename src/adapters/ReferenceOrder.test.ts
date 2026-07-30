import { describe, expect, it } from "vitest";
import type { CachedMetadataPort, ReferencePort } from "./obsidianPorts";
import { FRONTMATTER_REFERENCE_OFFSET, ReferenceOrder } from "./ReferenceOrder";

function ref(link: string, offset: number): ReferencePort {
	return { link, position: { start: { offset } } };
}

/** The link texts alone — what the ordering-only cases care about. */
function linksOf(cache: CachedMetadataPort): readonly string[] {
	return ReferenceOrder.orderedReferences(cache).map((reference) => reference.link);
}

describe("ReferenceOrder.orderedReferences (link order)", () => {
	it("WHEN links and embeds interleave in the body THEN they are merged by start offset", () => {
		const ordered = linksOf({
			links: [ref("late-link", 30), ref("early-link", 5)],
			embeds: [ref("middle-embed", 10)],
		});
		expect(ordered).toEqual(["early-link", "middle-embed", "late-link"]);
	});

	it("WHEN frontmatter links exist THEN they come first (top of the file, no body offset)", () => {
		const ordered = linksOf({
			links: [ref("body-link", 0)],
			frontmatterLinks: [{ link: "property-link" }],
		});
		expect(ordered).toEqual(["property-link", "body-link"]);
	});

	it("WHEN the cache has no reference arrays at all THEN the order is empty", () => {
		expect(ReferenceOrder.orderedReferences({})).toEqual([]);
	});
});

describe("ReferenceOrder.orderedReferences (document offsets)", () => {
	it("WHEN frontmatter and body links exist THEN frontmatter comes first at FRONTMATTER_REFERENCE_OFFSET", () => {
		const ordered = ReferenceOrder.orderedReferences({
			links: [ref("body-link", 0)],
			frontmatterLinks: [{ link: "property-link" }],
		});
		expect(ordered).toEqual([
			{ link: "property-link", offset: FRONTMATTER_REFERENCE_OFFSET, kind: "link" },
			{ link: "body-link", offset: 0, kind: "link" },
		]);
	});

	it("WHEN body links and embeds interleave THEN they come back ascending by start offset", () => {
		const ordered = ReferenceOrder.orderedReferences({
			links: [ref("late-link", 30), ref("early-link", 5)],
			embeds: [ref("middle-embed", 10)],
		});
		expect(ordered).toEqual([
			{ link: "early-link", offset: 5, kind: "link" },
			{ link: "middle-embed", offset: 10, kind: "embed" },
			{ link: "late-link", offset: 30, kind: "link" },
		]);
	});
});

/**
 * Kind by ARRAY PROVENANCE: `cache.embeds` MEANS embed, `cache.links` MEANS plain
 * link, and `frontmatterLinks` can never be an embed. This is the markdown half of
 * the Stage-1 kind seam.
 */
describe("ReferenceOrder.orderedReferences (link kinds by provenance)", () => {
	function kindsByLinkOf(cache: CachedMetadataPort): Record<string, string> {
		return Object.fromEntries(
			ReferenceOrder.orderedReferences(cache).map((reference) => [reference.link, reference.kind]),
		);
	}

	it("WHEN a reference comes from cache.links THEN its kind is a plain link", () => {
		expect(kindsByLinkOf({ links: [ref("plain", 5)] })).toEqual({ plain: "link" });
	});

	it("WHEN a reference comes from cache.embeds THEN its kind is an embed", () => {
		expect(kindsByLinkOf({ embeds: [ref("pic.png", 5)] })).toEqual({ "pic.png": "embed" });
	});

	it("WHEN a frontmatter property link exists THEN its kind is a plain link (property links are never embeds)", () => {
		expect(kindsByLinkOf({ frontmatterLinks: [{ link: "property-link" }] })).toEqual({
			"property-link": "link",
		});
	});

	it("WHEN the SAME target is both linked and embedded THEN each reference keeps its own kind", () => {
		const ordered = ReferenceOrder.orderedReferences({
			links: [ref("note-b", 30)],
			embeds: [ref("note-b", 5)],
		});
		expect(ordered).toEqual([
			{ link: "note-b", offset: 5, kind: "embed" },
			{ link: "note-b", offset: 30, kind: "link" },
		]);
	});
});

/**
 * CROSS-CHECK of the two runtime signals Obsidian offers. Provenance is what
 * production reads; `Reference.original` (the source text as written) is the
 * independent signal, documented but flagged "Not available on Publish". This
 * suite authors realistic references ONCE and derives BOTH sides from them, so it
 * fails if provenance and the `!` prefix could ever disagree — i.e. it is the
 * tripwire on the assumption that makes the cheap signal safe to trust.
 */
describe("ReferenceOrder.orderedReferences (provenance agrees with Reference.original)", () => {
	/** One reference as the author WROTE it — the single source both sides are derived from. */
	interface AuthoredReference {
		readonly original: string;
		readonly link: string;
		readonly offset: number;
	}

	const AUTHORED: readonly AuthoredReference[] = [
		{ original: "[[plain-note]]", link: "plain-note", offset: 5 },
		{ original: "![[embedded-note]]", link: "embedded-note", offset: 20 },
		{ original: "![[pic.png]]", link: "pic.png", offset: 40 },
		{ original: "[label](other.md)", link: "other.md", offset: 60 },
		{ original: "![alt](chart.png)", link: "chart.png", offset: 80 },
	];

	/** Obsidian's own routing rule: an embed goes to `cache.embeds`, everything else to `cache.links`. */
	const EMBED_PREFIX = "!";
	const cache: CachedMetadataPort = {
		links: AUTHORED.filter((authored) => !authored.original.startsWith(EMBED_PREFIX)).map((authored) =>
			ref(authored.link, authored.offset),
		),
		embeds: AUTHORED.filter((authored) => authored.original.startsWith(EMBED_PREFIX)).map((authored) =>
			ref(authored.link, authored.offset),
		),
	};

	it("WHEN kinds are derived from provenance THEN they match the kinds implied by each reference's original text", () => {
		const kindByLink = new Map(
			ReferenceOrder.orderedReferences(cache).map((reference) => [reference.link, reference.kind]),
		);
		const kindsFromProvenance = AUTHORED.map((authored) => kindByLink.get(authored.link));
		const kindsFromOriginal = AUTHORED.map((authored) =>
			authored.original.startsWith(EMBED_PREFIX) ? "embed" : "link",
		);
		expect(kindsFromProvenance).toEqual(kindsFromOriginal);
	});
});
