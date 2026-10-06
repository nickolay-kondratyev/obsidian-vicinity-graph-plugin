import { describe, expect, it } from "vitest";
import { InlineFieldKeys } from "./InlineFieldKeys";

/**
 * The key of the inline field the link at `marker` sits in. `marker` is the
 * substring the LINK starts with (its first occurrence on the line), which is how
 * Obsidian's link cache reports positions — the matcher never parses links itself.
 */
function keyOfLinkAt(line: string, marker: string): string | null {
	const column = line.indexOf(marker);
	if (column < 0) {
		throw new Error(`fixture error: ${marker} not in ${line}`);
	}
	return InlineFieldKeys.keyAtColumn(line, column);
}

describe("InlineFieldKeys.keyAtColumn — a field that starts the line", () => {
	it("WHEN a line is `key:: [[target]]` THEN the link takes the key", () => {
		expect(keyOfLinkAt("improves:: [[X]]", "[[X]]")).toBe("improves");
	});

	it("WHEN the field line is indented THEN the link still takes the key", () => {
		expect(keyOfLinkAt("    improves:: [[X]]", "[[X]]")).toBe("improves");
	});

	it("WHEN the field sits in a `-` list item THEN the link takes the key", () => {
		expect(keyOfLinkAt("- improves:: [[X]]", "[[X]]")).toBe("improves");
	});

	it("WHEN the field sits in a `*` list item THEN the link takes the key", () => {
		expect(keyOfLinkAt("* improves:: [[X]]", "[[X]]")).toBe("improves");
	});

	it("WHEN the field sits in a `+` list item THEN the link takes the key", () => {
		expect(keyOfLinkAt("+ improves:: [[X]]", "[[X]]")).toBe("improves");
	});

	it("WHEN the field sits in a numbered list item THEN the link takes the key", () => {
		expect(keyOfLinkAt("12. improves:: [[X]]", "[[X]]")).toBe("improves");
	});

	it("WHEN the field sits in a task item THEN the link takes the key", () => {
		expect(keyOfLinkAt("- [x] improves:: [[X]]", "[[X]]")).toBe("improves");
	});

	it("WHEN the field sits in a blockquote THEN the link takes the key", () => {
		expect(keyOfLinkAt("> improves:: [[X]]", "[[X]]")).toBe("improves");
	});

	it("WHEN there is no space after `::` THEN the link still takes the key", () => {
		expect(keyOfLinkAt("improves::[[X]]", "[[X]]")).toBe("improves");
	});

	it("WHEN the link follows other value text THEN it still takes the key", () => {
		expect(keyOfLinkAt("improves:: mostly [[X]]", "[[X]]")).toBe("improves");
	});

	it("WHEN the link is an embed THEN it takes the key", () => {
		expect(keyOfLinkAt("shows:: ![[X]]", "![[X]]")).toBe("shows");
	});

	it("WHEN the link is a markdown link THEN it takes the key", () => {
		expect(keyOfLinkAt("improves:: [the x](x.md)", "[the x]")).toBe("improves");
	});
});

describe("InlineFieldKeys.keyAtColumn — several links after one key", () => {
	const line = "rel:: [[a]], [[b]]";

	it("WHEN several links follow one key THEN the first takes the key", () => {
		expect(keyOfLinkAt(line, "[[a]]")).toBe("rel");
	});

	it("WHEN several links follow one key THEN a later one takes the key too", () => {
		expect(keyOfLinkAt(line, "[[b]]")).toBe("rel");
	});

	it("WHEN a second `key::` follows on the line THEN the links after it take the SECOND key", () => {
		expect(keyOfLinkAt("a:: [[x]] b:: [[y]]", "[[y]]")).toBe("b");
	});

	it("WHEN a second `key::` follows on the line THEN the links before it keep the FIRST key", () => {
		expect(keyOfLinkAt("a:: [[x]] b:: [[y]]", "[[x]]")).toBe("a");
	});

	it("WHEN a markdown link sits between the key and the link THEN the link keeps the key", () => {
		expect(keyOfLinkAt("rel:: [the x](x.md) [[y]]", "[[y]]")).toBe("rel");
	});

	it("WHEN inline code with `::` sits between the key and the link THEN the code does not switch the key", () => {
		expect(keyOfLinkAt("uses:: `std::move` [[y]]", "[[y]]")).toBe("uses");
	});

	it("WHEN a url sits between the key and the link THEN its single colon does not switch the key", () => {
		expect(keyOfLinkAt("rel:: https://example.com [[y]]", "[[y]]")).toBe("rel");
	});
});

describe("InlineFieldKeys.keyAtColumn — bracketed fields", () => {
	it("WHEN the field is `[key:: [[target]]]` mid-sentence THEN the link takes the key", () => {
		expect(keyOfLinkAt("This [improves:: [[X]]] a lot.", "[[X]]")).toBe("improves");
	});

	it("WHEN the field is `(key:: [[target]])` mid-sentence THEN the link takes the key", () => {
		expect(keyOfLinkAt("This (improves:: [[X]]) a lot.", "[[X]]")).toBe("improves");
	});

	it("WHEN a link follows a CLOSED bracketed field THEN it takes no key", () => {
		expect(keyOfLinkAt("[improves:: [[X]]] and [[Y]]", "[[Y]]")).toBeNull();
	});

	it("WHEN several links sit inside one bracketed field THEN the later one takes the key too", () => {
		expect(keyOfLinkAt("(rel:: [[a]], [[b]]) end", "[[b]]")).toBe("rel");
	});

	it("WHEN a bracketed field sits inside a line field THEN its link takes the INNER key", () => {
		expect(keyOfLinkAt("a:: [[x]] (b:: [[y]]) [[z]]", "[[y]]")).toBe("b");
	});

	it("WHEN a link follows a closed bracketed field inside a line field THEN it takes the LINE key again", () => {
		expect(keyOfLinkAt("a:: [[x]] (b:: [[y]]) [[z]]", "[[z]]")).toBe("a");
	});

	it("WHEN a plain parenthetical sits inside a line field THEN its link keeps the line key", () => {
		expect(keyOfLinkAt("rel:: see (mostly [[y]])", "[[y]]")).toBe("rel");
	});
});

describe("InlineFieldKeys.keyAtColumn — no field", () => {
	it("WHEN the line has no `key::` THEN the link takes no key", () => {
		expect(keyOfLinkAt("see [[X]] for more", "[[X]]")).toBeNull();
	});

	it("WHEN an unbracketed `key::` sits mid-sentence THEN it is prose, not a field", () => {
		expect(keyOfLinkAt("I think improves:: [[X]]", "[[X]]")).toBeNull();
	});

	it("WHEN the link comes BEFORE the field on the line THEN it takes no key", () => {
		expect(keyOfLinkAt("[[X]] (rel:: [[Y]])", "[[X]]")).toBeNull();
	});

	it("WHEN the key has a space THEN it is not a field key", () => {
		expect(keyOfLinkAt("has space:: [[X]]", "[[X]]")).toBeNull();
	});

	it("WHEN the key is empty THEN it is not a field", () => {
		expect(keyOfLinkAt(":: [[X]]", "[[X]]")).toBeNull();
	});

	it("WHEN the line is a heading THEN `key::` in it is not a field", () => {
		expect(keyOfLinkAt("# improves:: [[X]]", "[[X]]")).toBeNull();
	});
});

describe("InlineFieldKeys.keyAtColumn — key characters", () => {
	it("WHEN the key mixes letters, digits, `-` and `_` THEN the whole key is returned", () => {
		expect(keyOfLinkAt("part_of-2:: [[X]]", "[[X]]")).toBe("part_of-2");
	});

	it("WHEN the key has non-ASCII letters THEN the whole key is returned", () => {
		expect(keyOfLinkAt("größer:: [[X]]", "[[X]]")).toBe("größer");
	});

	it("WHEN the key is written in capitals THEN it is returned as written", () => {
		expect(keyOfLinkAt("Improves:: [[X]]", "[[X]]")).toBe("Improves");
	});
});

describe("InlineFieldKeys.keyAtOffset", () => {
	const text = "---\nid: 1\n---\nintro [[A]]\nimproves:: [[B]]\n";

	it("WHEN the offset points at a link on a field line THEN that line's key is returned", () => {
		expect(InlineFieldKeys.keyAtOffset(text, text.indexOf("[[B]]"))).toBe("improves");
	});

	it("WHEN the offset points at a link on a plain line THEN no key is returned", () => {
		expect(InlineFieldKeys.keyAtOffset(text, text.indexOf("[[A]]"))).toBeNull();
	});

	it("WHEN the link is on the first line of the text THEN its key is returned", () => {
		expect(InlineFieldKeys.keyAtOffset("rel:: [[A]]\nnext", "rel:: ".length)).toBe("rel");
	});

	it("WHEN the line ends with CRLF THEN the key is still returned", () => {
		const crlf = "intro\r\nrel:: [[A]]\r\nnext";
		expect(InlineFieldKeys.keyAtOffset(crlf, crlf.indexOf("[[A]]"))).toBe("rel");
	});
});
