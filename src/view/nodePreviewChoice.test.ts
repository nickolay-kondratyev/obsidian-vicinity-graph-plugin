import { describe, expect, it } from "vitest";
import { NODE_CONTENT_OVERRIDES } from "../engine";
import { NODE_CONTENT_INHERIT_META, NODE_PREVIEW_OPTION_META } from "./nodePreviewPreferenceMeta";
import {
	currentNodeContentChoice,
	NODE_CONTENT_CHOICES,
	planNodeContentMenu,
	resolveNodePreviewPreference,
} from "./nodePreviewChoice";

/**
 * The per-node CONTENT override layer that sits in front of the pure chooser
 * (ticket nid_9hx6okamx3yt0rg9iad2f4151_e). "Inherit" is the ABSENCE of an
 * override — never a stored value — so these lock that a set override REPLACES the
 * global preference and a cleared one falls back to it.
 */

describe("resolveNodePreviewPreference", () => {
	it("WHEN a node has no content override THEN it resolves to the global preference", () => {
		expect(resolveNodePreviewPreference("auto", undefined)).toBe("auto");
	});

	it("WHEN a node has a content override THEN it resolves to the override, not the global", () => {
		expect(resolveNodePreviewPreference("auto", "image")).toBe("image");
	});

	it("WHEN the override matches the global THEN the resolved preference is unchanged", () => {
		expect(resolveNodePreviewPreference("outline", "outline")).toBe("outline");
	});

	it("WHEN the override is title-only THEN the resolved preference is title-only", () => {
		// The per-node choice added by this ticket, absent from the override union before it.
		expect(resolveNodePreviewPreference("auto", "title-only")).toBe("title-only");
	});
});

describe("currentNodeContentChoice", () => {
	it("WHEN a node has no override THEN its current choice is Inherit", () => {
		expect(currentNodeContentChoice(undefined)).toBe("inherit");
	});

	it("WHEN a node has an override THEN its current choice is that override value", () => {
		expect(currentNodeContentChoice("outline")).toBe("outline");
	});
});

describe("NODE_CONTENT_CHOICES", () => {
	it("WHEN the gear menu lists its content choices THEN Inherit is first, then every override value in order", () => {
		expect(NODE_CONTENT_CHOICES).toEqual(["inherit", ...NODE_CONTENT_OVERRIDES]);
	});
});

describe("planNodeContentMenu", () => {
	it("WHEN a node inherits THEN the Inherit item is the checked one", () => {
		const checked = planNodeContentMenu("inherit")
			.filter((item) => item.checked)
			.map((item) => item.choice);
		expect(checked).toEqual(["inherit"]);
	});

	it("WHEN a node overrides content THEN exactly that override item is checked", () => {
		const checked = planNodeContentMenu("image")
			.filter((item) => item.checked)
			.map((item) => item.choice);
		expect(checked).toEqual(["image"]);
	});

	it("WHEN the menu is planned THEN every choice is offered, in list order", () => {
		expect(planNodeContentMenu("inherit").map((item) => item.choice)).toEqual([...NODE_CONTENT_CHOICES]);
	});

	it("WHEN the Inherit item is labelled THEN it uses the Inherit copy", () => {
		const inherit = planNodeContentMenu("inherit").find((item) => item.choice === "inherit");
		expect(inherit?.label).toBe(NODE_CONTENT_INHERIT_META.label);
	});

	it("WHEN an override item is labelled THEN it reuses the shared per-option copy", () => {
		const outline = planNodeContentMenu("inherit").find((item) => item.choice === "outline");
		expect(outline?.label).toBe(NODE_PREVIEW_OPTION_META.outline.label);
	});
});
