import { FuzzySuggestModal } from "obsidian";
import type { App, FuzzyMatch } from "obsidian";
import type { Tag } from "../shared/Tags";
import { GraphModeCopy } from "./graphMode";
import type { TagNoteCount } from "./tagNoteCounts";

/**
 * The "Show notes with tag…" picker: a fuzzy search over the vault's tags, each
 * with how many notes it would show, most-used first (`tagNoteCountsOf`). Choosing
 * one hands the tag to `onPick` — the plugin's `enterTagMode`. Thin by design: the
 * list and its order are the pure, tested part.
 */
export class TagPickerModal extends FuzzySuggestModal<TagNoteCount> {
	constructor(
		app: App,
		private readonly entries: readonly TagNoteCount[],
		private readonly onPick: (tag: Tag) => void,
	) {
		super(app);
		this.setPlaceholder("Type a tag to show every note carrying it…");
		this.emptyStateText = "No tag matches what you typed.";
	}

	getItems(): TagNoteCount[] {
		return [...this.entries];
	}

	/** What the fuzzy search matches: the tag as the user writes it (`#todo`), never the count. */
	getItemText(entry: TagNoteCount): string {
		return GraphModeCopy.tagLabel(entry.tag);
	}

	renderSuggestion(match: FuzzyMatch<TagNoteCount>, el: HTMLElement): void {
		el.addClass("vicinity-graph-tag-picker__item");
		// The base class renders the highlighted tag; the count rides beside it, muted.
		super.renderSuggestion(match, el.createDiv({ cls: "vicinity-graph-tag-picker__tag" }));
		el.createSpan({ cls: "vicinity-graph-tag-picker__count", text: GraphModeCopy.noteCount(match.item.noteCount) });
	}

	onChooseItem(entry: TagNoteCount): void {
		this.onPick(entry.tag);
	}
}
