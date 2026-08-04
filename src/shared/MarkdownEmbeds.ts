/**
 * Embeds (`![[…]]`) rewritten to a one-line MARKER for DISPLAY — ticket
 * `nid_yw2m80g72pahcvtsxi09o7vkd_e`.
 *
 * WHY: the link-preview drawer renders each context snippet through Obsidian's
 * markdown renderer, which EXPANDS an embed into the whole embedded note (or
 * image). A row meant to show ONE line then shows an entire document. The
 * marker `!<<Name>>` keeps the FACT that the occurrence is an embed — the `!`
 * — while naming the target instead of inlining it.
 *
 * A DISPLAY transform, so it names the target the way a reader would: the
 * written alias (unless it is a {@link SIZE_SPEC}, which names nothing), else
 * the target's frontmatter title (supplied by the caller — only an adapter can
 * resolve a link text against the vault), else the file name.
 *
 * DELIBERATELY NOT code-aware: like `view/outlineEntryLabel` (and unlike the
 * canvas harvesting that masks with {@link MarkdownCodeRegions}), this is about
 * what a reader SEES, and a snippet is a few lines of prose. An `![[x]]`
 * written inside a code span is flattened too — a cosmetic miss in a preview,
 * not a wrong graph.
 *
 * Wikilink embeds ONLY: markdown-style `![alt](img.png)` embeds are a different
 * syntax whose expansion (an image) is the sibling `MarkdownInlineLinks`'s
 * territory; nothing has asked for it yet.
 */

import { FileKinds } from "./FileKinds";
import { LinkKinds } from "./LinkKind";
import { VaultPathFacts } from "./VaultPathFacts";
import { Wikilinks } from "./Wikilinks";
import type { WikilinkParts } from "./Wikilinks";

/** The marker an embed collapses to, around its display name. */
const MARKER_OPEN = "!<<";
const MARKER_CLOSE = ">>";

/**
 * Every ASCII punctuation character — CommonMark allows a backslash escape on
 * ALL of them, so escaping the whole marker makes it render VERBATIM. Load
 * bearing: `<<Name>>` reaches the renderer as raw HTML (`<Name …>` is a
 * well-formed open tag) and would otherwise vanish from the rendered row.
 */
const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/g;

/**
 * A pipe value that is a SIZE, not a name: on an EMBED Obsidian reads `|300` /
 * `|300x200` as the rendered width (×height), so `![[chart.png|300]]` names
 * nothing and must still be named by its target. Shape-based rather than
 * kind-based on purpose — the same rule then holds for a note embed sized by a
 * theme snippet, and it needs no vault resolution to decide.
 */
const SIZE_SPEC = /^\d+(x\d+)?$/;

/**
 * Whitespace RUN inside a display name, collapsed to one space. The marker
 * exists to keep an occurrence on ONE line, and a name it takes from the vault
 * is arbitrary user text — a YAML block scalar (`title: |`) keeps its newlines,
 * which would otherwise break the very row this shortens.
 */
const WHITESPACE_RUN = /\s+/g;

/**
 * The target's display title as the VAULT knows it (frontmatter `title`/`name`),
 * for the link path written in the embed; `null` when unresolvable or untitled.
 */
export type EmbedTargetTitle = (linkPath: string) => string | null;

export class MarkdownEmbeds {
	/** `markdown` with every embed replaced by its marker; plain links untouched. */
	static flattened(markdown: string, titleOf: EmbedTargetTitle): string {
		return markdown.replace(Wikilinks.globalPattern(), (match, marker: string, innerText: string) =>
			LinkKinds.ofEmbedMarker(marker) === "embed"
				? markerFor(displayNameOf(Wikilinks.partsOf(innerText), titleOf))
				: match,
		);
	}
}

/** The rendered marker around `displayName`: kept to one line, then escaped whole. */
function markerFor(displayName: string): string {
	return escapedForMarkdown(MARKER_OPEN + displayName.replace(WHITESPACE_RUN, " ") + MARKER_CLOSE);
}

/**
 * What the marker names, most-specific first: the alias the writer chose, the
 * target's frontmatter title, the target's file name. A same-file embed
 * (`![[#Heading]]`) has no target to name, so its subpath is the name.
 */
function displayNameOf(parts: WikilinkParts, titleOf: EmbedTargetTitle): string {
	if (parts.alias !== "" && !SIZE_SPEC.test(parts.alias)) {
		return parts.alias;
	}
	if (parts.target === "") {
		return parts.subpath;
	}
	return titleOf(parts.target) ?? fileNameOf(parts.target);
}

/**
 * The written target's file name. The extension stays for attachments
 * (`![[chart.png]]` → `chart.png`, which is how Obsidian names them) and goes
 * for notes, whose extension is never spelled in the UI. WHICH extension is a
 * note's is {@link FileKinds}'s knowledge, not a second `.md` literal here — and
 * it is case-blind, because the vault decides casing (`Note.MD` is that note).
 */
function fileNameOf(target: string): string {
	const basename = VaultPathFacts.basenameOf(target);
	return FileKinds.isMarkdownPath(basename) ? VaultPathFacts.titleOf(basename) : basename;
}

function escapedForMarkdown(text: string): string {
	return text.replace(ASCII_PUNCTUATION, "\\$&");
}
