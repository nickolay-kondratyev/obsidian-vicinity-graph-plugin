import type { OpenNoteOptions } from "./viewPorts";

/**
 * The pure "what does this click mean" decisions for opening a note from the
 * graph (precedent: {@link planNodePinAction}). Kept out of the components so
 * the node body and the outline entries can never disagree about the gesture.
 */

/** The click modifiers we read — a structural slice of `MouseEvent`. */
export interface ClickModifiers {
	readonly ctrlKey: boolean;
	readonly metaKey: boolean;
}

/**
 * Ctrl (windows/linux) / cmd (mac) = open in a NEW tab (CLARIFICATION Q2).
 * ONE definition, shared by the node-body click and outline-entry clicks.
 */
export function opensInNewTab(modifiers: ClickModifiers): boolean {
	return modifiers.ctrlKey || modifiers.metaKey;
}

/**
 * Open options for a click on an OUTLINE ENTRY: the same new-tab gesture as the
 * node body, plus the heading to position at.
 *
 * `rawHeading` is passed through VERBATIM — it is `OutlineEntry.rawText`, and
 * sanitising it into a link subpath is the adapter's job (`ObsidianNoteNavigator`
 * uses Obsidian's own `stripHeadingForLink`). A pure module cannot import
 * `obsidian`, and half-sanitising here would be a second, worse truth.
 */
export function outlineEntryOpenOptions(rawHeading: string, modifiers: ClickModifiers): OpenNoteOptions {
	return { newTab: opensInNewTab(modifiers), heading: rawHeading };
}
