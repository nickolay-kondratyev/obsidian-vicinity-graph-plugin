import { describe, expect, it } from "vitest";
import {
	PARENT_RELATIONSHIP_NAME,
	relationshipLookupPairs,
	resolveEdgeRelationship,
	resolveEdgeRelationships,
} from "./EdgeRelationships";
import type { RelationshipEdge, RelationshipSources } from "./EdgeRelationships";
import { asVaultPath, directedLinkKey } from "./types";

const A = asVaultPath("a.md");
const B = asVaultPath("b.md");
const PARENT = asVaultPath("Jon.md");
const CHILD = asVaultPath("Jon/kid.md");

function linkEdge(source = A, target = B): RelationshipEdge {
	return { source, target, count: 1, hierarchy: false };
}

/** Folder note → child, no link between them: dashed, badgeless. */
const PURE_HIERARCHY: RelationshipEdge = { source: PARENT, target: CHILD, count: 0, hierarchy: true };

/** The folder note ALSO links its child: one solid edge carrying both relations. */
const MERGED_HIERARCHY: RelationshipEdge = { source: PARENT, target: CHILD, count: 1, hierarchy: true };

function syntax(entries: readonly (readonly [string, string, readonly string[]])[]): RelationshipSources {
	return {
		syntax: new Map(entries.map(([source, target, names]) => [directedLinkKey(asVaultPath(source), asVaultPath(target)), names])),
	};
}

const NO_SOURCES: RelationshipSources = syntax([]);

describe("resolveEdgeRelationship — names from note syntax", () => {
	it("WHEN the source note names the link THEN the edge takes that name", () => {
		expect(resolveEdgeRelationship(linkEdge(), syntax([["a.md", "b.md", ["improves"]]]))).toEqual({
			name: "improves",
			origin: "syntax",
		});
	});

	it("WHEN the source note gives the link several names THEN the edge shows them all, in note order", () => {
		const sources = syntax([["a.md", "b.md", ["improves", "blocks"]]]);
		expect(resolveEdgeRelationship(linkEdge(), sources)?.name).toBe("improves, blocks");
	});

	it("WHEN only the REVERSE direction is named THEN a link edge stays unnamed (directed)", () => {
		expect(resolveEdgeRelationship(linkEdge(A, B), syntax([["b.md", "a.md", ["improves"]]]))).toBeNull();
	});

	it("WHEN nothing names a link edge THEN it stays unnamed", () => {
		expect(resolveEdgeRelationship(linkEdge(), NO_SOURCES)).toBeNull();
	});

	it("WHEN a name list is empty THEN the edge stays unnamed", () => {
		expect(resolveEdgeRelationship(linkEdge(), syntax([["a.md", "b.md", []]]))).toBeNull();
	});
});

describe("resolveEdgeRelationship — the folder-hierarchy default", () => {
	it("WHEN a pure folder-hierarchy edge has no other name THEN it is named `parent`", () => {
		expect(resolveEdgeRelationship(PURE_HIERARCHY, NO_SOURCES)).toEqual({
			name: PARENT_RELATIONSHIP_NAME,
			origin: "folder-hierarchy",
		});
	});

	it("WHEN the child names its link to the folder note THEN the `parent` default is hidden", () => {
		expect(resolveEdgeRelationship(PURE_HIERARCHY, syntax([["Jon/kid.md", "Jon.md", ["rel"]]]))).toBeNull();
	});

	it("WHEN the folder note names a link to the child THEN the syntax name replaces `parent`", () => {
		expect(resolveEdgeRelationship(PURE_HIERARCHY, syntax([["Jon.md", "Jon/kid.md", ["owns"]]]))).toEqual({
			name: "owns",
			origin: "syntax",
		});
	});

	it("WHEN the folder note also links the child (merged edge) THEN no `parent` default is added", () => {
		expect(resolveEdgeRelationship(MERGED_HIERARCHY, NO_SOURCES)).toBeNull();
	});
});

describe("resolveEdgeRelationships", () => {
	it("WHEN edges resolve THEN the map is keyed by each edge's directed link key", () => {
		const resolved = resolveEdgeRelationships([linkEdge(), PURE_HIERARCHY], syntax([["a.md", "b.md", ["improves"]]]));
		expect([...resolved.keys()]).toEqual([directedLinkKey(A, B), directedLinkKey(PARENT, CHILD)]);
	});

	it("WHEN an edge resolves to no name THEN it has no entry", () => {
		expect(resolveEdgeRelationships([linkEdge()], NO_SOURCES).size).toBe(0);
	});
});

describe("relationshipLookupPairs", () => {
	it("WHEN edges are link edges THEN each edge's own direction is looked up", () => {
		expect(relationshipLookupPairs([linkEdge(A, B)])).toEqual([{ source: A, target: B }]);
	});

	it("WHEN an edge is pure folder hierarchy THEN the child → folder-note direction is looked up too", () => {
		expect(relationshipLookupPairs([PURE_HIERARCHY])).toEqual([
			{ source: PARENT, target: CHILD },
			{ source: CHILD, target: PARENT },
		]);
	});

	it("WHEN the reverse pair is already an edge THEN it is looked up once", () => {
		expect(relationshipLookupPairs([PURE_HIERARCHY, linkEdge(CHILD, PARENT)])).toHaveLength(2);
	});
});
