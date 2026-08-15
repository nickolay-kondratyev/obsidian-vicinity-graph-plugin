import { describe, expect, it } from "vitest";
import { MarkdownCodeRegions } from "./MarkdownCodeRegions";

/** What a masked region looks like: same length, all spaces. */
function blank(region: string): string {
	return " ".repeat(region.length);
}

describe("MarkdownCodeRegions.withCodeMasked", () => {
	it("WHEN the text has no code THEN it comes back untouched", () => {
		expect(MarkdownCodeRegions.withCodeMasked("plain [[a]] text")).toBe("plain [[a]] text");
	});

	it("WHEN an inline code span carries a link THEN the span is blanked", () => {
		expect(MarkdownCodeRegions.withCodeMasked("see `[[a]]` here")).toBe(`see ${blank("`[[a]]`")} here`);
	});

	it("WHEN a code span is blanked THEN the surrounding text keeps its offsets", () => {
		const masked = MarkdownCodeRegions.withCodeMasked("see `[[a]]` here");
		expect(masked.length).toBe("see `[[a]]` here".length);
	});

	it("WHEN a backtick opens no span THEN it stays literal text", () => {
		expect(MarkdownCodeRegions.withCodeMasked("a ` [[b]]")).toBe("a ` [[b]]");
	});

	it("WHEN a double-backtick span contains a single backtick THEN the whole span is blanked", () => {
		expect(MarkdownCodeRegions.withCodeMasked("``[[a]]`b`` c")).toBe(`${blank("``[[a]]`b``")} c`);
	});

	it("WHEN two spans sit on one line THEN both are blanked and the text between survives", () => {
		expect(MarkdownCodeRegions.withCodeMasked("`[[a]]` mid `[[b]]`")).toBe(
			`${blank("`[[a]]`")} mid ${blank("`[[b]]`")}`,
		);
	});

	it("WHEN a fenced block carries a link THEN every fence line is blanked", () => {
		const text = ["before [[a]]", "```", "[[b]]", "```", "after [[c]]"].join("\n");
		const masked = ["before [[a]]", "   ", "     ", "   ", "after [[c]]"].join("\n");
		expect(MarkdownCodeRegions.withCodeMasked(text)).toBe(masked);
	});

	it("WHEN a fence is opened by tildes THEN it is masked too", () => {
		expect(MarkdownCodeRegions.withCodeMasked(["~~~", "[[b]]", "~~~"].join("\n"))).toBe(
			["   ", "     ", "   "].join("\n"),
		);
	});

	it("WHEN a fence carries an info string THEN the opener still opens the block", () => {
		expect(MarkdownCodeRegions.withCodeMasked(["```ts", "[[b]]", "```"].join("\n"))).toBe(
			["     ", "     ", "   "].join("\n"),
		);
	});

	it("WHEN a backtick fence is closed by a SHORTER run THEN the block stays open", () => {
		expect(MarkdownCodeRegions.withCodeMasked(["````", "``", "[[b]]", "````"].join("\n"))).toBe(
			["    ", "  ", "     ", "    "].join("\n"),
		);
	});

	it("WHEN a fence-content line carries an info string THEN the fence stays open (a closer takes no info string)", () => {
		// CommonMark: a CLOSING fence may not carry an info string, so "```ts" is
		// fence CONTENT — treating it as a closer would leak [[phantom]] as prose.
		expect(MarkdownCodeRegions.withCodeMasked(["```", "```ts", "[[phantom]]", "```"].join("\n"))).toBe(
			["   ", "     ", "           ", "   "].join("\n"),
		);
	});

	it("WHEN a closer carries only trailing spaces THEN it still closes the fence", () => {
		expect(MarkdownCodeRegions.withCodeMasked(["```", "[[b]]", "```  ", "[[kept]]"].join("\n"))).toBe(
			["   ", "     ", "     ", "[[kept]]"].join("\n"),
		);
	});

	it("WHEN a line is an inline triple-backtick span THEN it opens no fence (backtick info strings hold no backtick)", () => {
		// CommonMark: a BACKTICK fence's info string may not contain a backtick, so
		// this line is an inline code span — the span is blanked, the prose around
		// it and every following line stay prose.
		expect(MarkdownCodeRegions.withCodeMasked(["```cmd``` prose [[kept]]", "[[also-prose]]"].join("\n"))).toBe(
			[`${blank("```cmd```")} prose [[kept]]`, "[[also-prose]]"].join("\n"),
		);
	});

	it("WHEN a fence is never closed THEN it masks to the end of the text (CommonMark)", () => {
		expect(MarkdownCodeRegions.withCodeMasked(["```", "[[b]]"].join("\n"))).toBe(["   ", "     "].join("\n"));
	});

	it("WHEN a fence opener is indented past three spaces THEN it is not a fence", () => {
		expect(MarkdownCodeRegions.withCodeMasked(["    ```", "[[b]]"].join("\n"))).toBe(["    ```", "[[b]]"].join("\n"));
	});

	// KNOWN BUG (ticket nid_b7k6gymkwum7pozwnf28vgecb_e) — with CRLF line
	// endings, split("\n") leaves a trailing \r on
	// every line; FENCE_OPENER still opens (the \r reads as an info string) but
	// FENCE_CLOSER's `[ \t]*$` rejects "```\r", so the fence never closes and
	// every line after the first code block is blanked — links after it vanish
	// from canvas fallback harvesting. Unskip (flip `it.skip` to `it`) when fixing.
	it.skip("WHEN the text uses CRLF line endings THEN a closing fence still closes the block", () => {
		const masked = MarkdownCodeRegions.withCodeMasked(["```\r", "code\r", "```\r", "[[kept]]"].join("\n"));
		expect(masked).toContain("[[kept]]");
	});

	it("WHEN an unpaired backtick opens a line THEN following lines still get masked on their own (per-line scanning)", () => {
		// KNOWN 80/20 residual: CommonMark lets a code span cross a newline; this
		// scanner is per-line, so line two is treated as prose.
		expect(MarkdownCodeRegions.withCodeMasked(["`[[a]]", "[[b]]`"].join("\n"))).toBe(["`[[a]]", "[[b]]`"].join("\n"));
	});
});
