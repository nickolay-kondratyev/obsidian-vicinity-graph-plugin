import { describe, expect, it } from "vitest";
import { RelationshipStatements } from "./RelationshipStatements";
import type { RelationshipName, RelationshipStatement } from "./RelationshipStatements";

/**
 * The pure named-relationship parser. BDD, one behavior per test — every form,
 * the precedence collisions between them, punctuation/comma-run boundaries,
 * embeds, qualifiers, the wrapped rel-note variant, code/frontmatter masking,
 * and degenerate inputs.
 */

/** The single statement `text` parses to; fails loudly if it is not exactly one. */
function onlyStatement(text: string): RelationshipStatement {
	const statements = RelationshipStatements.parse(text);
	expect(statements.length).toBe(1);
	return statements[0] as RelationshipStatement;
}

/** The target link texts of the single statement, in order. */
function onlyTargets(text: string): readonly string[] {
	return onlyStatement(text).targets.map((target) => target.linkText);
}

/** A text name, asserting the kind so a rel-note never sneaks past as text. */
function textName(name: RelationshipName): string {
	expect(name.kind).toBe("text");
	return name.kind === "text" ? name.text : "";
}

describe("RelationshipStatements bare form", () => {
	it("WHEN a bare statement stands alone THEN the name is the word before ::", () => {
		expect(textName(onlyStatement("supports::[[note2]]").name)).toBe("supports");
	});

	it("WHEN a bare statement stands alone THEN the target is the link", () => {
		expect(onlyTargets("supports::[[note2]]")).toEqual(["note2"]);
	});

	it("WHEN prose precedes the name THEN only the longest name-char run is the name", () => {
		expect(textName(onlyStatement("prose.he-supports::[[x]]").name)).toBe("he-supports");
	});

	it("WHEN the name sits mid-sentence THEN surrounding prose is ignored", () => {
		expect(textName(onlyStatement("I think supports::[[x]] here").name)).toBe("supports");
	});

	it("WHEN whitespace separates :: from its target THEN the target still parses", () => {
		expect(onlyTargets("up:: [[a]]")).toEqual(["a"]);
	});

	it("WHEN a bare name has whitespace before :: THEN nothing parses", () => {
		expect(RelationshipStatements.parse("supports ::[[x]]")).toEqual([]);
	});

	it("WHEN the whole bare statement is parsed THEN the span covers name through targets", () => {
		expect(onlyStatement("supports::[[note2]]").span).toEqual({ start: 0, end: 19 });
	});

	it("WHEN a bare statement is unwrapped THEN it has no qualifier", () => {
		expect(onlyStatement("supports::[[x]] but not strongly").qualifier).toBeNull();
	});

	it("WHEN a bare statement has trailing prose THEN the prose is ignored", () => {
		expect(onlyTargets("supports::[[x]] but not strongly")).toEqual(["x"]);
	});
});

describe("RelationshipStatements bracketed form", () => {
	it("WHEN a statement is wrapped in [] THEN the name is the text before ::", () => {
		expect(textName(onlyStatement("[he supports:: [[x]]]").name)).toBe("he supports");
	});

	it("WHEN a statement is wrapped in () THEN it parses via the bracketed form", () => {
		expect(textName(onlyStatement("(he-supports::[[x]])").name)).toBe("he-supports");
	});

	it("WHEN the wrapped name has a leading space after the opener THEN it is trimmed", () => {
		expect(textName(onlyStatement("[ supports:: [[x]]]").name)).toBe("supports");
	});

	it("WHEN there is whitespace before :: inside a wrapper THEN nothing parses", () => {
		expect(RelationshipStatements.parse("[he supports :: [[x]]]")).toEqual([]);
	});

	it("WHEN a bracketed statement closes THEN the span consumes the closing bracket", () => {
		expect(onlyStatement("[he supports:: [[x]]]").span).toEqual({ start: 0, end: 21 });
	});

	it("WHEN text follows the target before the closer THEN it is the qualifier", () => {
		expect(onlyStatement("[supports:: [[x]] but not strongly]").qualifier).toBe("but not strongly");
	});

	it("WHEN nothing follows the target before the closer THEN the qualifier is empty", () => {
		expect(onlyStatement("[supports:: [[x]]]").qualifier).toBe("");
	});

	it("WHEN the qualifier contains a link THEN that link stays inside the qualifier text", () => {
		expect(onlyStatement("[supports:: [[x]] see [[y]]]").qualifier).toBe("see [[y]]");
	});

	it("WHEN the qualifier contains a link THEN it is NOT parsed as a target", () => {
		expect(onlyTargets("[supports:: [[x]] see [[y]]]")).toEqual(["x"]);
	});
});

describe("RelationshipStatements rel-note form", () => {
	it("WHEN the name is a wikilink THEN the statement is a rel-note", () => {
		expect(onlyStatement("[[he supports]]::[[x]]").name.kind).toBe("rel-note");
	});

	it("WHEN the rel note has no alias THEN the label is its basename", () => {
		const name = onlyStatement("[[folder/he supports]]::[[x]]").name;
		expect(name.kind === "rel-note" ? name.label : "").toBe("he supports");
	});

	it("WHEN the rel note carries an alias THEN the label is the alias", () => {
		const name = onlyStatement("[[he supports|backs]]::[[x]]").name;
		expect(name.kind === "rel-note" ? name.label : "").toBe("backs");
	});

	it("WHEN the rel note carries an alias THEN the link text is the target only", () => {
		const name = onlyStatement("[[he supports|backs]]::[[x]]").name;
		expect(name.kind === "rel-note" ? name.linkText : "").toBe("he supports");
	});

	it("WHEN a rel-note statement parses THEN the occurrence spans the name link only", () => {
		const name = onlyStatement("[[he supports]]::[[x]]").name;
		expect(name.kind === "rel-note" ? name.occurrence : null).toEqual({ start: 0, end: 15 });
	});

	it("WHEN a plain rel-note has trailing prose THEN there is no qualifier", () => {
		expect(onlyStatement("[[he supports]]::[[x]] strongly").qualifier).toBeNull();
	});
});

describe("RelationshipStatements wrapped rel-note", () => {
	const WRAPPED = "[ [[he supports]]:: [[x]] but not strongly ]";

	it("WHEN a rel note sits in a wrapper split by whitespace only THEN the name stays the rel note", () => {
		expect(onlyStatement(WRAPPED).name.kind).toBe("rel-note");
	});

	it("WHEN a rel note sits in a whitespace-only wrapper THEN the trailing text is the qualifier", () => {
		expect(onlyStatement(WRAPPED).qualifier).toBe("but not strongly");
	});

	it("WHEN a rel note sits in a whitespace-only wrapper THEN the span consumes the closer", () => {
		expect(onlyStatement(WRAPPED).span).toEqual({ start: 0, end: WRAPPED.length });
	});

	it("WHEN prose precedes the rel note inside the brackets THEN it is a PLAIN rel-note", () => {
		expect(onlyStatement("[because [[he supports]]:: [[x]] q]").qualifier).toBeNull();
	});

	it("WHEN prose precedes the rel note inside the brackets THEN the brackets stay prose", () => {
		const name = onlyStatement("[because [[he supports]]:: [[x]] q]").name;
		expect(name.kind === "rel-note" ? name.occurrence.start : -1).toBe(9);
	});
});

describe("RelationshipStatements precedence", () => {
	it("WHEN a wrapped token ends with ]] THEN the rel-note form wins over bracketed", () => {
		expect(onlyStatement("[[he supports]]::[[x]]").name.kind).toBe("rel-note");
	});

	it("WHEN a paren wrapper holds one token THEN it parses bracketed, not bare", () => {
		expect(onlyStatement("(he-supports::[[x]])").span).toEqual({ start: 0, end: 20 });
	});

	it("WHEN a wrapper is already closed before :: THEN the form falls back to bare", () => {
		expect(textName(onlyStatement("[[a]] then foo::[[b]]").name)).toBe("foo");
	});
});

describe("RelationshipStatements targets", () => {
	it("WHEN targets are comma-separated THEN every link in the run is captured", () => {
		expect(onlyTargets("up:: [[a]], [[b]], [[c]]")).toEqual(["a", "b", "c"]);
	});

	it("WHEN a non-link follows a comma THEN the run stops at the last link", () => {
		expect(onlyTargets("up:: [[a]], and [[b]]")).toEqual(["a"]);
	});

	it("WHEN a target is an embed THEN its isEmbed flag is set", () => {
		expect(onlyStatement("rel::![[x]]").targets[0]?.isEmbed).toBe(true);
	});

	it("WHEN a target is a plain link THEN its isEmbed flag is false", () => {
		expect(onlyStatement("rel::[[x]]").targets[0]?.isEmbed).toBe(false);
	});

	it("WHEN a link and an embed are mixed in the run THEN both are captured in order", () => {
		expect(onlyStatement("rel:: [[a]], ![[b]]").targets.map((t) => t.isEmbed)).toEqual([false, true]);
	});

	it("WHEN aliases and subpaths decorate a target THEN only the target text is kept", () => {
		expect(onlyTargets("rel::[[note#heading|Alias]]")).toEqual(["note"]);
	});

	it("WHEN :: is followed by no link THEN nothing parses", () => {
		expect(RelationshipStatements.parse("rel:: not a link")).toEqual([]);
	});

	it("WHEN :: is followed by a pure-subpath link THEN nothing parses", () => {
		expect(RelationshipStatements.parse("rel::[[#heading]]")).toEqual([]);
	});
});

describe("RelationshipStatements masking", () => {
	it("WHEN a statement sits in a fenced code block THEN it is not a statement", () => {
		expect(RelationshipStatements.parse("```\nsupports::[[x]]\n```")).toEqual([]);
	});

	it("WHEN a statement sits in an inline code span THEN it is not a statement", () => {
		expect(RelationshipStatements.parse("prose `supports::[[x]]` prose")).toEqual([]);
	});

	it("WHEN a :: field sits in the leading frontmatter THEN it is not a statement", () => {
		expect(RelationshipStatements.parse("---\nup::[[x]]\n---\nbody")).toEqual([]);
	});

	it("WHEN a real field lives in the body below frontmatter THEN it still parses", () => {
		expect(onlyTargets("---\ntitle: t\n---\nsupports::[[x]]")).toEqual(["x"]);
	});

	it("WHEN a statement follows an inline code span THEN its offsets stay FILE offsets", () => {
		const text = "`code` supports::[[x]]";
		expect(onlyStatement(text).span.start).toBe(text.indexOf("supports"));
	});

	it("WHEN a --- rule is NOT a leading frontmatter block THEN a field after it still parses", () => {
		expect(onlyTargets("body text\n---\nsupports::[[x]]")).toEqual(["x"]);
	});
});

describe("RelationshipStatements degenerate inputs", () => {
	it("WHEN the text is empty THEN nothing parses", () => {
		expect(RelationshipStatements.parse("")).toEqual([]);
	});

	it("WHEN there is no :: at all THEN nothing parses", () => {
		expect(RelationshipStatements.parse("just [[a]] plain [[b]] links")).toEqual([]);
	});

	it("WHEN :: opens the text with no name THEN nothing parses", () => {
		expect(RelationshipStatements.parse("::[[x]]")).toEqual([]);
	});

	it("WHEN a wrapper has no name before :: THEN nothing parses", () => {
		expect(RelationshipStatements.parse("[:: [[x]]]")).toEqual([]);
	});

	it("WHEN two statements share a line THEN both parse independently", () => {
		expect(RelationshipStatements.parse("a::[[x]] b::[[y]]").map((s) => s.targets[0]?.linkText)).toEqual([
			"x",
			"y",
		]);
	});
});
