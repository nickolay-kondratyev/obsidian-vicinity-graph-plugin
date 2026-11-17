import { describe, expect, it } from "vitest";
import { tagOfMenuSite } from "./tagMenuChoice";
import type { TagMenuSite } from "./tagMenuChoice";

/** The key of the tag the menu item would show, or `undefined` = no menu item. */
function offeredTagKey(site: TagMenuSite): string | undefined {
	return tagOfMenuSite(site)?.key;
}

describe("tagOfMenuSite (does a right-click get 'show tagged notes', and for which tag)", () => {
	it("WHEN the editor cursor is on a body hashtag THEN that tag is offered", () => {
		expect(offeredTagKey({ kind: "editor", lineText: "See #Project here", offset: 6 })).toBe("project");
	});

	it("WHEN the editor cursor is on plain text THEN nothing is offered", () => {
		expect(offeredTagKey({ kind: "editor", lineText: "See #Project here", offset: 1 })).toBeUndefined();
	});

	it("WHEN a rendered tag (reading view) is right-clicked THEN its tag is offered", () => {
		expect(offeredTagKey({ kind: "rendered-tag", text: "#project/alpha" })).toBe("project/alpha");
	});

	it("WHEN a tags-pane row (no #) is right-clicked THEN its tag is offered", () => {
		expect(offeredTagKey({ kind: "rendered-tag", text: "project/alpha" })).toBe("project/alpha");
	});

	it("WHEN a rendered element's text holds a space THEN it is no tag and nothing is offered", () => {
		expect(offeredTagKey({ kind: "rendered-tag", text: "not a tag" })).toBeUndefined();
	});

	it("WHEN a pill of the tags property is right-clicked THEN its tag is offered", () => {
		expect(offeredTagKey({ kind: "property-pill", propertyKey: "tags", text: "todo" })).toBe("todo");
	});

	it("WHEN the tags property key is written in another casing THEN its pill still offers the tag", () => {
		expect(offeredTagKey({ kind: "property-pill", propertyKey: "Tags", text: "todo" })).toBe("todo");
	});

	it("WHEN a pill of ANOTHER list property is right-clicked THEN nothing is offered", () => {
		expect(offeredTagKey({ kind: "property-pill", propertyKey: "aliases", text: "todo" })).toBeUndefined();
	});

	it("WHEN an empty pill is right-clicked THEN nothing is offered", () => {
		expect(offeredTagKey({ kind: "property-pill", propertyKey: "tags", text: "  " })).toBeUndefined();
	});
});
