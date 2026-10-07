import { describe, expect, it } from "vitest";
import { aiCandidateEdges, aiContentChars, aiEdgeEligibility, hasEnoughAiContent, MIN_AI_CONTENT_CHARS } from "./AiEligibility";
import type { AiEdgeEligibility, AiEligibilityFacts } from "./AiEligibility";
import type { RelationshipEdge, StoredRelationship } from "./EdgeRelationships";
import { asVaultPath, directedLinkKey } from "./types";
import type { VaultPath } from "./types";

const A = asVaultPath("a.md");
const B = asVaultPath("b.md");
const BOARD = asVaultPath("board.canvas");
const PHOTO = asVaultPath("photo.png");
const PARENT = asVaultPath("Jon.md");
const CHILD = asVaultPath("Jon/kid.md");

function linkEdge(source: VaultPath = A, target: VaultPath = B): RelationshipEdge {
	return { source, target, count: 1, hierarchy: false };
}

const PURE_HIERARCHY: RelationshipEdge = { source: PARENT, target: CHILD, count: 0, hierarchy: true };
const MERGED_HIERARCHY: RelationshipEdge = { source: PARENT, target: CHILD, count: 1, hierarchy: true };

const AI_NAME: StoredRelationship = { name: "extends", origin: "ai", model: "gpt-6-luna" };
const MANUAL_NAME: StoredRelationship = { name: "supports", origin: "manual" };
const DISMISSED_AI_NAME: StoredRelationship = { name: null, origin: "ai" };

interface FactsSpec {
	readonly syntax?: readonly (readonly [VaultPath, VaultPath])[];
	readonly stored?: readonly (readonly [VaultPath, VaultPath, StoredRelationship])[];
	readonly grouped?: readonly VaultPath[];
}

function facts(spec: FactsSpec = {}): AiEligibilityFacts {
	return {
		sources: {
			syntax: new Map((spec.syntax ?? []).map(([source, target]) => [directedLinkKey(source, target), ["rel"]])),
			stored: new Map((spec.stored ?? []).map(([source, target, stored]) => [directedLinkKey(source, target), stored])),
		},
		groupedPaths: new Set(spec.grouped ?? []),
	};
}

describe("aiEdgeEligibility — the text-free checks", () => {
	const table: readonly { readonly when: string; readonly edge: RelationshipEdge; readonly facts: AiEligibilityFacts; readonly then: AiEdgeEligibility }[] = [
		{ when: "an unnamed link between two notes", edge: linkEdge(), facts: facts(), then: "candidate" },
		{ when: "a note links a canvas", edge: linkEdge(A, BOARD), facts: facts(), then: "candidate" },
		{ when: "the source names the link in syntax", edge: linkEdge(), facts: facts({ syntax: [[A, B]] }), then: "already-named" },
		{ when: "the pair has a manual name", edge: linkEdge(), facts: facts({ stored: [[A, B, MANUAL_NAME]] }), then: "already-named" },
		{ when: "the pair has an AI name", edge: linkEdge(), facts: facts({ stored: [[A, B, AI_NAME]] }), then: "already-named" },
		{ when: "the pair's AI name was dismissed", edge: linkEdge(), facts: facts({ stored: [[A, B, DISMISSED_AI_NAME]] }), then: "already-named" },
		{ when: "only the REVERSE direction has a syntax name", edge: linkEdge(), facts: facts({ syntax: [[B, A]] }), then: "candidate" },
		{ when: "only the REVERSE direction has a stored name", edge: linkEdge(), facts: facts({ stored: [[B, A, MANUAL_NAME]] }), then: "candidate" },
		{ when: "the source renders in a folder group", edge: linkEdge(), facts: facts({ grouped: [A] }), then: "grouped-note" },
		{ when: "the target renders in a folder group", edge: linkEdge(), facts: facts({ grouped: [B] }), then: "grouped-note" },
		{ when: "the edge is a pure folder-hierarchy edge", edge: PURE_HIERARCHY, facts: facts(), then: "folder-hierarchy" },
		{ when: "the folder note also LINKS its child (merged edge)", edge: MERGED_HIERARCHY, facts: facts(), then: "candidate" },
		{ when: "the target is an image", edge: linkEdge(A, PHOTO), facts: facts(), then: "unsupported-file" },
		{ when: "the source is an image", edge: linkEdge(PHOTO, A), facts: facts(), then: "unsupported-file" },
	];

	for (const row of table) {
		it(`WHEN ${row.when} THEN it is ${row.then}`, () => {
			expect(aiEdgeEligibility(row.edge, row.facts)).toBe(row.then);
		});
	}
});

describe("aiCandidateEdges", () => {
	it("WHEN a build holds candidates and named edges THEN only the candidates come back, as directed pairs in order", () => {
		const edges = [linkEdge(A, B), linkEdge(B, A), PURE_HIERARCHY, linkEdge(A, BOARD)];
		expect(aiCandidateEdges(edges, facts({ stored: [[B, A, MANUAL_NAME]] }))).toEqual([
			{ source: A, target: B },
			{ source: A, target: BOARD },
		]);
	});
});

describe("aiContentChars — the note's own prose", () => {
	it("WHEN text has whitespace THEN only non-whitespace characters count", () => {
		expect(aiContentChars("ab c\n\td  ")).toBe(4);
	});

	it("WHEN a note has frontmatter THEN the frontmatter does not count", () => {
		expect(aiContentChars("---\nid: abc\ntags: [x]\n---\nbody")).toBe("body".length);
	});

	it("WHEN a note holds wikilinks and embeds THEN the link syntax does not count", () => {
		expect(aiContentChars("see [[Some Long Note|alias]] and ![[pic.png]] now")).toBe("seeandnow".length);
	});

	it("WHEN a note holds markdown links THEN the link syntax does not count", () => {
		expect(aiContentChars("read [the guide](guide.md) first")).toBe("readfirst".length);
	});

	it("WHEN a note is only a link THEN it has no prose", () => {
		expect(aiContentChars("[[Target note with a very long title indeed]]")).toBe(0);
	});
});

describe("hasEnoughAiContent", () => {
	it(`WHEN a note has exactly ${MIN_AI_CONTENT_CHARS} prose characters THEN it is enough`, () => {
		expect(hasEnoughAiContent("x".repeat(MIN_AI_CONTENT_CHARS))).toBe(true);
	});

	it("WHEN a note has one prose character too few THEN it is not enough", () => {
		expect(hasEnoughAiContent("x".repeat(MIN_AI_CONTENT_CHARS - 1))).toBe(false);
	});

	it("WHEN a long note's length is mostly a link and frontmatter THEN it is not enough", () => {
		const padding = "y".repeat(MIN_AI_CONTENT_CHARS);
		expect(hasEnoughAiContent(`---\nnote: ${padding}\n---\n[[${padding}]]\nshort`)).toBe(false);
	});
});
