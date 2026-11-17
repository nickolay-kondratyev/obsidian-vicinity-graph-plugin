import { Menu } from "obsidian";
import type { Plugin } from "obsidian";
import type { Tag } from "../shared/Tags";
import { SHOW_TAGGED_NOTES_MENU_TITLE, editorTagSiteOf, tagMenuSiteOf, tagOfMenuSite } from "./tagMenuChoice";

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
 * - the editor (Live Preview and Source) builds its own menu and fires
 *   `editor-menu` for plugins to extend. That event carries no click position and
 *   the editor's cursor has not moved to the click yet, so the right-clicked
 *   element is remembered on the way DOWN (a capture-phase `contextmenu`) and read
 *   when `editor-menu` fires for that same click;
 * - every other surface (reading-view tags, the core Tags pane, the tags
 *   property's pills) is caught as a bubbling `contextmenu` on the document and
 *   joined through `Menu.forEvent`, which returns the menu Obsidian already opened
 *   for THIS event (a property pill's Edit / Copy / Remove) or opens one — so the
 *   item is added alongside Obsidian's own, never as a second menu.
 *
 * CEILING: only the main window's document is hooked (a popout window's tags get
 * no item), and a keyboard-opened editor menu (no right-clicked element) gets none.
 */
export class TagFilterMenus {
	/** The element of the latest right-click, for the `editor-menu` that click triggers. */
	private lastRightClicked: Element | null = null;

	constructor(private readonly showTaggedNotes: (tag: Tag) => void) {}

	/** Registers the hooks on `plugin`, which removes them on unload. */
	register(plugin: Plugin): void {
		plugin.registerDomEvent(document, "contextmenu", (event) => this.rememberRightClicked(event), { capture: true });
		plugin.registerEvent(plugin.app.workspace.on("editor-menu", (menu) => this.onEditorMenu(menu)));
		plugin.registerDomEvent(document, "contextmenu", (event) => this.onContextMenu(event));
	}

	private rememberRightClicked(event: MouseEvent): void {
		this.lastRightClicked = event.target instanceof Element ? event.target : null;
	}

	private onEditorMenu(menu: Menu): void {
		const target = this.lastRightClicked;
		// Consumed: a later editor menu with no right-click of its own must not reuse it.
		this.lastRightClicked = null;
		const site = target === null ? undefined : editorTagSiteOf(target);
		const tag = site === undefined ? undefined : tagOfMenuSite(site);
		if (tag !== undefined) {
			this.addItem(menu, tag);
		}
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
