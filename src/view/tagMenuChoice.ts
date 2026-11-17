import { ObsidianTags } from "../adapters/ObsidianTags";
import { BodyHashtags } from "../shared/BodyHashtags";
import { Tags } from "../shared/Tags";
import type { Tag } from "../shared/Tags";

/**
 * THE decision behind the "Vicinity graph: show tagged notes" right-click item
 * (tags-v1 decision 8, ticket `nid_6qj8n7uc7zz126l3ix8czfymq_e`): WHERE the user
 * right-clicked is read into a {@link TagMenuSite} ({@link tagMenuSiteOf} for the
 * DOM surfaces, the editor's own cursor for the editor), and {@link tagOfMenuSite}
 * says which tag — if any — the item is offered for. No `obsidian` import: the
 * `Menu` plumbing is `TagFilterMenus`, which only asks here.
 */

/** The item's title — one wording on every surface. */
export const SHOW_TAGGED_NOTES_MENU_TITLE = "Vicinity graph: show tagged notes";

/** A right-clicked place that may name a tag. */
export type TagMenuSite =
	/** The editor (Live Preview or Source): the cursor's line and its offset in it. */
	| { readonly kind: "editor"; readonly lineText: string; readonly offset: number }
	/** A tag Obsidian rendered as text: a reading-view `a.tag` (`#todo`) or a tags-pane row (`todo`). */
	| { readonly kind: "rendered-tag"; readonly text: string }
	/** A pill of a list property in the Properties block; only the tags property's pills are tags. */
	| { readonly kind: "property-pill"; readonly propertyKey: string; readonly text: string };

const WHITESPACE = /\s/;

/** The tag the menu item is offered for at `site`; `undefined` = no item. */
export function tagOfMenuSite(site: TagMenuSite): Tag | undefined {
	switch (site.kind) {
		case "editor":
			return BodyHashtags.at(site.lineText, site.offset);
		case "rendered-tag":
			return tagOfText(site.text);
		case "property-pill":
			return ObsidianTags.isTagsPropertyKey(site.propertyKey) ? tagOfText(site.text) : undefined;
	}
}

/** A single tag written as text; text with a space is no tag (Obsidian drops it too). */
function tagOfText(text: string): Tag | undefined {
	const trimmed = text.trim();
	return WHITESPACE.test(trimmed) ? undefined : Tags.parse(trimmed);
}

// [Obsidian 1.12 DOM]: the class names below are what the core app renders; there
// is no API for "the tag under this element". Re-check on an Obsidian bump — the
// e2e spec `tagFilterEntryPoints.e2e.ts` drives each surface for real.
const READING_VIEW_TAG = "a.tag";
/** Inside an editor the editor's own menu owns the click (`editor-menu`). */
const EDITOR = ".cm-editor";
const TAGS_PANE_ROW = ".tag-pane-tag";
/** The row's first inner-text node holds the FULL nested tag (`project/` + `alpha`). */
const TAGS_PANE_ROW_TEXT = ".tree-item-inner-text";
const PROPERTY_PILL = ".multi-select-pill";
const PROPERTY_PILL_TEXT = ".multi-select-pill-content";
const PROPERTY = ".metadata-property";
const PROPERTY_KEY_ATTRIBUTE = "data-property-key";

/** The tag surface `target` belongs to; `undefined` when it is none of them. */
export function tagMenuSiteOf(target: Element): TagMenuSite | undefined {
	const pill = target.closest(PROPERTY_PILL);
	if (pill !== null) {
		const propertyKey = pill.closest(PROPERTY)?.getAttribute(PROPERTY_KEY_ATTRIBUTE);
		const text = pill.querySelector(PROPERTY_PILL_TEXT)?.textContent;
		return propertyKey == null || text == null ? undefined : { kind: "property-pill", propertyKey, text };
	}
	const paneRow = target.closest(TAGS_PANE_ROW);
	if (paneRow !== null) {
		const text = paneRow.querySelector(TAGS_PANE_ROW_TEXT)?.textContent;
		return text == null ? undefined : { kind: "rendered-tag", text };
	}
	const readingTag = target.closest(READING_VIEW_TAG);
	if (readingTag !== null && readingTag.closest(EDITOR) === null) {
		return { kind: "rendered-tag", text: readingTag.textContent ?? "" };
	}
	return undefined;
}
