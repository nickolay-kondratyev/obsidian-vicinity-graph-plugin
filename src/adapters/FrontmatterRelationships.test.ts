import { describe, expect, it } from "vitest";
import { asVaultPath } from "../engine";
import type { VaultPath } from "../engine";
import { FrontmatterRelationships, relationNameOf } from "./FrontmatterRelationships";
import type { FrontmatterLinkPort } from "./obsidianPorts";

/** A resolver that maps known link texts to vault paths and dangles the rest. */
function resolverOf(map: Record<string, string>): (link: string) => VaultPath | undefined {
	return (link) => (map[link] === undefined ? undefined : asVaultPath(map[link]));
}

function fmLink(key: string, link: string): FrontmatterLinkPort {
	return { key, link };
}

describe("FrontmatterRelationships.namedReferences", () => {
	it("WHEN a scalar link field is present THEN it yields the target labeled by the field key", () => {
		const references = FrontmatterRelationships.namedReferences(
			[fmLink("up", "parent")],
			resolverOf({ parent: "parent.md" }),
		);
		expect(references).toEqual([{ target: "parent.md", kind: "link", relations: [{ name: "up" }] }]);
	});

	it("WHEN a list field flattens to indexed keys THEN every element shares the ONE base relation name", () => {
		const references = FrontmatterRelationships.namedReferences(
			[fmLink("up.0", "a"), fmLink("up.1", "b")],
			resolverOf({ a: "a.md", b: "b.md" }),
		);
		expect(references).toEqual([
			{ target: "a.md", kind: "link", relations: [{ name: "up" }] },
			{ target: "b.md", kind: "link", relations: [{ name: "up" }] },
		]);
	});

	it("WHEN a frontmatter target does not resolve THEN it is dropped (graceful degradation)", () => {
		const references = FrontmatterRelationships.namedReferences(
			[fmLink("up", "ghost")],
			resolverOf({}),
		);
		expect(references).toEqual([]);
	});

	it("WHEN a frontmatter link is present THEN its kind is a plain link, never an embed", () => {
		const [reference] = FrontmatterRelationships.namedReferences(
			[fmLink("cover", "pic")],
			resolverOf({ pic: "pic.png" }),
		);
		expect(reference?.kind).toBe("link");
	});

	it("WHEN there are no frontmatter links THEN there are no references", () => {
		expect(FrontmatterRelationships.namedReferences(undefined, resolverOf({}))).toEqual([]);
	});
});

describe("relationNameOf", () => {
	it("WHEN the key is a plain field THEN it is the relation name verbatim", () => {
		expect(relationNameOf("up")).toBe("up");
	});

	it("WHEN the key carries a numeric list-index suffix THEN the suffix is stripped", () => {
		expect(relationNameOf("up.3")).toBe("up");
	});

	it("WHEN the key is a nested object property THEN the non-numeric segment is kept", () => {
		expect(relationNameOf("related.parent")).toBe("related.parent");
	});
});
