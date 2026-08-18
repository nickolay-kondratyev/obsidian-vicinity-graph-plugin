import { describe, expect, it } from "vitest";
import { asFolderPath, asVaultPath } from "../engine";
import {
	extraImageCountText,
	groupHiddenTitleText,
	hiddenOverlayText,
	linkCountBadgeText,
	orphanBreakdownTitle,
	plusNText,
	relationLabelText,
	VAULT_ROOT_LABEL,
} from "./badgeText";

describe("plusNText", () => {
	it("WHEN formatting a count THEN it renders as +N", () => {
		expect(plusNText(3)).toBe("+3");
	});
});

describe("hiddenOverlayText", () => {
	it("WHEN formatting the overlay total THEN it renders as +N hidden", () => {
		expect(hiddenOverlayText(5)).toBe("+5 hidden");
	});
});

describe("extraImageCountText", () => {
	it("WHEN a node has several images THEN the badge counts those beyond the first", () => {
		expect(extraImageCountText(3)).toBe("+2");
	});

	it("WHEN a node has a single image THEN there is no badge", () => {
		expect(extraImageCountText(1)).toBeNull();
	});
});

describe("groupHiddenTitleText", () => {
	it("WHEN several notes are hidden THEN the tooltip pluralizes", () => {
		expect(groupHiddenTitleText(3)).toBe("3 more notes in this folder are not shown");
	});

	it("WHEN one note is hidden THEN the tooltip is singular", () => {
		expect(groupHiddenTitleText(1)).toBe("1 more note in this folder is not shown");
	});
});

describe("linkCountBadgeText", () => {
	it("WHEN an edge collapses several links THEN the badge shows the multiplicity", () => {
		expect(linkCountBadgeText(2)).toBe("×2");
	});

	it("WHEN an edge represents a single link THEN there is no badge", () => {
		expect(linkCountBadgeText(1)).toBeNull();
	});
});

describe("relationLabelText", () => {
	it("WHEN a relation has no qualifier THEN the label is its bare name", () => {
		expect(relationLabelText({ name: "supports" })).toBe("supports");
	});

	it("WHEN a relation has a qualifier THEN the target position is marked and the qualifier trails", () => {
		expect(relationLabelText({ name: "supports", qualifier: "but not strongly" })).toBe(
			"supports [X] but not strongly",
		);
	});

	it("WHEN a rel-note relation maps THEN its rel-note target never surfaces in the label text", () => {
		expect(relationLabelText({ name: "he supports", relNoteTarget: asVaultPath("rel/he-supports.md") })).toBe(
			"he supports",
		);
	});
});

describe("orphanBreakdownTitle", () => {
	it("WHEN formatting the breakdown THEN each folder gets its own line", () => {
		const title = orphanBreakdownTitle([
			{ folder: asFolderPath("gone"), hiddenCount: 3 },
			{ folder: asFolderPath("lost"), hiddenCount: 2 },
		]);
		expect(title).toBe("gone — 3 hidden\nlost — 2 hidden");
	});

	it("WHEN the vault root has hidden nodes THEN it is labelled instead of showing an empty path", () => {
		expect(orphanBreakdownTitle([{ folder: asFolderPath(""), hiddenCount: 1 }])).toBe(
			`${VAULT_ROOT_LABEL} — 1 hidden`,
		);
	});
});
