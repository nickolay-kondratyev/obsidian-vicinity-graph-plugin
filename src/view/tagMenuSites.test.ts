// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { editorTagSiteOf, tagMenuSiteOf, tagOfMenuSite } from "./tagMenuChoice";

/**
 * Reading a right-clicked element into a {@link TagMenuSite}, over fixture markup
 * that mirrors Obsidian 1.12's own DOM (the real DOM is covered by the e2e spec).
 */
function elementIn(html: string, selector: string): Element {
	// Test-authored fixture markup, parsed inert (no script runs) — never user input.
	document.body.replaceChildren(...Array.from(new DOMParser().parseFromString(html, "text/html").body.childNodes));
	const element = document.querySelector(selector);
	if (element === null) {
		throw new Error(`fixture bug: no [${selector}]`);
	}
	return element;
}

describe("tagMenuSiteOf (which tag surface was right-clicked)", () => {
	it("WHEN a reading-view tag link is right-clicked THEN it is a rendered tag carrying its text", () => {
		const target = elementIn(`<div class="markdown-preview-view"><a class="tag" href="#todo">#todo</a></div>`, "a.tag");

		expect(tagMenuSiteOf(target)).toEqual({ kind: "rendered-tag", text: "#todo" });
	});

	it("WHEN a tag link INSIDE an editor is right-clicked THEN it is no site (the editor menu owns it)", () => {
		const target = elementIn(`<div class="cm-editor"><a class="tag" href="#todo">#todo</a></div>`, "a.tag");

		expect(tagMenuSiteOf(target)).toBeUndefined();
	});

	it("WHEN the count of a tags-pane row is right-clicked THEN the row's full nested tag is the site", () => {
		const target = elementIn(
			`<div class="tree-item-self tag-pane-tag"><div class="tree-item-inner"><div class="tree-item-inner-text">` +
				`<span class="tag-pane-tag-parent">project/</span><span class="tree-item-inner-text">alpha</span></div></div>` +
				`<div class="tree-item-flair-outer"><span class="tag-pane-tag-count">3</span></div></div>`,
			".tag-pane-tag-count",
		);

		expect(tagMenuSiteOf(target)).toEqual({ kind: "rendered-tag", text: "project/alpha" });
	});

	it("WHEN a property pill is right-clicked THEN it is a pill carrying its property key and text", () => {
		const target = elementIn(
			`<div class="metadata-property" data-property-key="tags"><div class="multi-select-pill">` +
				`<div class="multi-select-pill-content"><span>todo</span></div></div></div>`,
			".multi-select-pill-content span",
		);

		expect(tagMenuSiteOf(target)).toEqual({ kind: "property-pill", propertyKey: "tags", text: "todo" });
	});

	it("WHEN anything else is right-clicked THEN it is no site", () => {
		expect(tagMenuSiteOf(elementIn(`<p>plain</p>`, "p"))).toBeUndefined();
	});
});

describe("editorTagSiteOf (the tag span right-clicked in an editor line)", () => {
	/** GIVEN a Live Preview line: bold text rendered without its `**`, then two tags as begin/end spans. */
	const LINE =
		`<div class="cm-content"><div class="cm-line">See <strong>bold</strong> ` +
		`<span class="cm-hashtag cm-hashtag-begin">#</span><span class="cm-hashtag cm-hashtag-end">first</span> and ` +
		`<span class="cm-hashtag cm-hashtag-begin">#</span><span class="cm-hashtag cm-hashtag-end">second</span>.</div></div>`;

	it("WHEN the second tag's name is right-clicked THEN the site names that tag", () => {
		const site = editorTagSiteOf(elementIn(LINE, ".cm-hashtag-end:last-of-type"));

		expect(site === undefined ? undefined : tagOfMenuSite(site)?.key).toBe("second");
	});

	it("WHEN a tag's # is right-clicked THEN the site names that tag", () => {
		const site = editorTagSiteOf(elementIn(LINE, ".cm-hashtag-begin"));

		expect(site === undefined ? undefined : tagOfMenuSite(site)?.key).toBe("first");
	});

	it("WHEN plain text of the line is right-clicked THEN it is no site (a stale cursor must never pick a tag)", () => {
		expect(editorTagSiteOf(elementIn(LINE, "strong"))).toBeUndefined();
	});
});
