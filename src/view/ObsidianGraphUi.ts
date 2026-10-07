import { MarkdownRenderer, Menu, setIcon } from "obsidian";
import type { App, Component } from "obsidian";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import { attachmentIconId } from "./attachmentIcons";
import { planAttachmentMenu } from "./attachmentMenu";
import type { AttachmentMenuRequest, GraphUiPort, NodeMenuEntry, NodeMenuRequest } from "./viewPorts";

/**
 * Adapts Obsidian UI services (resource URLs, native menus, icon rendering) to
 * the {@link GraphUiPort} the React node components consume via context. The
 * ONLY view-layer home of these Obsidian calls, mirroring
 * {@link ObsidianNoteNavigator} for navigation.
 */
export class ObsidianGraphUi implements GraphUiPort {
	constructor(
		private readonly app: App,
		/** Lifecycle owner of rendered markdown (embed children unload with it) — the hosting `ItemView`. */
		private readonly component: Component,
	) {}

	resourcePath(path: string): string | null {
		const file = this.app.vault.getFileByPath(path);
		return file === null ? null : this.app.vault.getResourcePath(file);
	}

	showAttachmentMenu(request: AttachmentMenuRequest): void {
		const menu = new Menu();
		const plan = planAttachmentMenu(request.paths);
		for (const path of plan.visiblePaths) {
			menu.addItem((item) =>
				item
					.setTitle(VaultPathFacts.basenameOf(path))
					.setIcon(attachmentIconId(VaultPathFacts.extensionOf(path)))
					.onClick(() => this.openAttachment(path)),
			);
		}
		const overflowText = plan.overflowText;
		if (overflowText !== null) {
			menu.addItem((item) => item.setTitle(overflowText).setDisabled(true));
		}
		menu.showAtMouseEvent(request.nativeEvent);
	}

	showNodeMenu(request: NodeMenuRequest): void {
		const menu = new Menu();
		for (const entry of request.entries) {
			menu.addItem((item) => {
				item.setTitle(nodeMenuItemTitle(entry)).onClick(entry.onClick);
				// Each is set only when the entry declares it: a content choice carries a
				// `checked` state and no icon; a command (pin / reset) carries an icon and
				// no check. `setSection` groups + separates the gear menu's two halves.
				if (entry.iconId !== undefined) {
					item.setIcon(entry.iconId);
				}
				if (entry.checked !== undefined) {
					item.setChecked(entry.checked);
				}
				if (entry.section !== undefined) {
					item.setSection(entry.section);
				}
			});
		}
		menu.showAtMouseEvent(request.nativeEvent);
	}

	renderIcon(el: HTMLElement, iconId: string): void {
		setIcon(el, iconId);
	}

	renderMarkdown(el: HTMLElement, markdown: string, sourcePath: string): Promise<void> {
		// `render` APPENDS; clearing first makes re-runs (expand/collapse, React
		// StrictMode's doubled effects) replace instead of stack.
		el.replaceChildren();
		return MarkdownRenderer.render(this.app, markdown, el, sourcePath, this.component);
	}

	/** Obsidian default handling: attachments open in their default viewer (CLARIFICATION Q3). */
	private openAttachment(path: string): void {
		const file = this.app.vault.getFileByPath(path);
		if (file === null) {
			return;
		}
		void this.app.workspace.getLeaf(false).openFile(file);
	}
}

/**
 * A menu item's title, as a plain string OR — when the entry carries a
 * {@link NodeMenuEntry.description} — a fragment stacking the label over a muted
 * sub-line. Obsidian's `MenuItem.setTitle` takes a `DocumentFragment`, so this
 * is the supported way to add explanatory copy to one item without reaching into
 * the item's private DOM; the sub-line is styled by
 * `.vicinity-graph-menu-item__description` in `graph-view.css`.
 */
function nodeMenuItemTitle(entry: NodeMenuEntry): string | DocumentFragment {
	if (entry.description === undefined) {
		return entry.title;
	}
	return createFragment((frag) => {
		frag.createSpan({ text: entry.title });
		frag.createDiv({ cls: "vicinity-graph-menu-item__description", text: entry.description });
	});
}
