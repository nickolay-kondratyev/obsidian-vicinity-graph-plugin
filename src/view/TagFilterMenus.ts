import { Menu } from "obsidian";
import type { Editor, Plugin } from "obsidian";
import type { Tag } from "../shared/Tags";
import { SHOW_TAGGED_NOTES_MENU_TITLE, tagMenuSiteOf, tagOfMenuSite } from "./tagMenuChoice";
import type { TagMenuSite } from "./tagMenuChoice";

/** The graph view's own icon (`VicinityGraphView.getIcon`), so the item reads as "opens the graph". */
const GRAPH_ICON = "network";
/** Both Obsidian menus this joins declare an `open` section (the editor's, a property pill's). */
const MENU_SECTION = "open";

/**
 * The tag RIGHT-CLICK entry point (tags-v1 decision 8 — left-click stays Obsidian's
 * own tag search): adds "Vicinity graph: show tagged notes" to the menu of a
 * right-clicked tag. Thin Obsidian plumbing only — WHICH tag (if any) is decided by
 * the pure `tagMenuChoice.ts`.
 *
 * Two hooks, because Obsidian offers two kinds of menu:
 * - the editor (Live Preview and Source) fires `editor-menu`; Obsidian has already
 *   moved the cursor to the click, and reads it the same way for its own
 *   "Rename heading" item;
 * - every other surface (reading-view tags, the core Tags pane, the tags
 *   property's pills) is caught as a bubbling `contextmenu` on the document and
 *   joined through `Menu.forEvent`, which returns the menu Obsidian already opened
 *   for THIS event (a property pill's Edit / Copy / Remove) or opens one — so the
 *   item is added alongside Obsidian's own, never as a second menu.
 */
export class TagFilterMenus {
	constructor(private readonly showTaggedNotes: (tag: Tag) => void) {}

	/** Registers both hooks on `plugin`, which removes them on unload. */
	register(plugin: Plugin): void {
		plugin.registerEvent(plugin.app.workspace.on("editor-menu", (menu, editor) => this.onEditorMenu(menu, editor)));
		plugin.registerDomEvent(document, "contextmenu", (event) => this.onContextMenu(event));
	}

	private onEditorMenu(menu: Menu, editor: Editor): void {
		const cursor = editor.getCursor();
		this.offer(menu, { kind: "editor", lineText: editor.getLine(cursor.line), offset: cursor.ch });
	}

	private onContextMenu(event: MouseEvent): void {
		const target = event.target;
		if (!(target instanceof Element)) {
			return;
		}
		const site = tagMenuSiteOf(target);
		// Decided BEFORE `Menu.forEvent`: that call claims the event (preventDefault +
		// a menu), which only a tag surface may do.
		const tag = site === undefined ? undefined : tagOfMenuSite(site);
		if (tag !== undefined) {
			this.addItem(Menu.forEvent(event), tag);
		}
	}

	private offer(menu: Menu, site: TagMenuSite): void {
		const tag = tagOfMenuSite(site);
		if (tag !== undefined) {
			this.addItem(menu, tag);
		}
	}

	private addItem(menu: Menu, tag: Tag): void {
		menu.addItem((item) =>
			item
				.setTitle(SHOW_TAGGED_NOTES_MENU_TITLE)
				.setIcon(GRAPH_ICON)
				.setSection(MENU_SECTION)
				.onClick(() => this.showTaggedNotes(tag)),
		);
	}
}
