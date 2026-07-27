/**
 * What a wikilink LOOKS LIKE, in one place — shared because two layers ask the
 * same question about the same syntax: `view/outlineEntryLabel` strips the
 * markup for display, `adapters/CanvasFallbackParser` harvests link targets out
 * of canvas text-node bodies.
 *
 * A small honest matcher, NOT a markdown parser (same spirit as
 * `outlineEntryLabel`): one left-to-right pass, no code-span or escape
 * analysis. DELIBERATELY NOT HANDLED: `[[links]]` inside code spans/fences
 * (they are harvested as if they were real), and markdown-style `[a](b.md)`
 * links (see ticket `nid_ygo7h95ssgmunaqsprc1zlmfh_e`).
 */

/** Wikilinks and embeds; capture group 1 is the raw inner text (`target`, `target#heading|alias`, …). */
const WIKILINK_SOURCE = "!?\\[\\[([^\\]]+)\\]\\]";

/** Ends the link TARGET: an alias pipe or a `#heading`/`#^block` subpath. */
const TARGET_TERMINATOR = /[#|]/;

export class Wikilinks {
	/**
	 * A FRESH global matcher each call — a `/g` regex carries mutable `lastIndex`,
	 * so a shared module-level instance would let one caller's scan position leak
	 * into another's.
	 */
	static globalPattern(): RegExp {
		return new RegExp(WIKILINK_SOURCE, "g");
	}

	/**
	 * The link TARGETS written in `text`, in written order, duplicates kept
	 * (callers dedupe). Aliases and subpaths are stripped — `[[note#h|Alias]]`
	 * yields `note` — because that is the shape Obsidian's link RESOLUTION
	 * accepts (`getFirstLinkpathDest`). Pure-subpath links (`[[#heading]]`,
	 * same-file) yield nothing: they name no other document.
	 */
	static linkTargetsOf(text: string): readonly string[] {
		const targets: string[] = [];
		for (const match of text.matchAll(Wikilinks.globalPattern())) {
			const target = Wikilinks.targetOf(match[1] ?? "");
			if (target !== "") {
				targets.push(target);
			}
		}
		return targets;
	}

	private static targetOf(innerText: string): string {
		const terminator = innerText.search(TARGET_TERMINATOR);
		return (terminator === -1 ? innerText : innerText.slice(0, terminator)).trim();
	}
}
