import { describe, expect, it } from "vitest";
import { opensInNewTab, outlineEntryOpenOptions } from "./nodeOpenIntent";

describe("opensInNewTab", () => {
	it("WHEN ctrl is held THEN the note opens in a new tab", () => {
		expect(opensInNewTab({ ctrlKey: true, metaKey: false })).toBe(true);
	});

	it("WHEN meta (cmd) is held THEN the note opens in a new tab", () => {
		expect(opensInNewTab({ ctrlKey: false, metaKey: true })).toBe(true);
	});

	it("WHEN no modifier is held THEN the note reuses the current leaf", () => {
		expect(opensInNewTab({ ctrlKey: false, metaKey: false })).toBe(false);
	});
});

describe("outlineEntryOpenOptions", () => {
	it("WHEN an outline entry is clicked without a modifier THEN the options carry that RAW heading in the current tab", () => {
		expect(outlineEntryOpenOptions("Status of [[note1]] **today**", { ctrlKey: false, metaKey: false })).toEqual({
			newTab: false,
			heading: "Status of [[note1]] **today**",
		});
	});

	it("WHEN an outline entry is ctrl-clicked THEN the options carry that RAW heading in a new tab", () => {
		expect(outlineEntryOpenOptions("Background", { ctrlKey: true, metaKey: false })).toEqual({
			newTab: true,
			heading: "Background",
		});
	});
});
