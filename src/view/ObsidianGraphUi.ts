import { Menu, setIcon } from "obsidian";
import type { App, HoverPopover, HoverParent } from "obsidian";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import { attachmentIconId } from "./attachmentIcons";
import { planAttachmentMenu } from "./attachmentMenu";
import type { AttachmentMenuRequest, GraphUiPort, HoverPreviewRequest, NodeMenuRequest } from "./viewPorts";

/**
 * Adapts Obsidian UI services (resource URLs, `hover-link` page previews,
 * native menus, icon rendering) to the {@link GraphUiPort} the React node
 * components consume via context. The ONLY view-layer home of these Obsidian
 * calls, mirroring {@link ObsidianNoteNavigator} for navigation.
 *
 * Implements {@link HoverParent} because the Page-preview core plugin stores
 * the popover it opens on the event's `hoverParent` to manage its lifecycle.
 */
export class ObsidianGraphUi implements GraphUiPort, HoverParent {
	hoverPopover: HoverPopover | null = null;

	constructor(
		private readonly app: App,
		/** `hover-link` source id — the view type, registered in `main.ts` via `registerHoverLinkSource`. */
		private readonly hoverSourceId: string,
	) {}

	resourcePath(path: string): string | null {
		const file = this.app.vault.getFileByPath(path);
		return file === null ? null : this.app.vault.getResourcePath(file);
	}

	showHoverPreview(request: HoverPreviewRequest): void {
		this.app.workspace.trigger("hover-link", {
			event: request.nativeEvent,
			source: this.hoverSourceId,
			hoverParent: this,
			targetEl: request.targetEl,
			linktext: request.path,
			sourcePath: request.path,
		});
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
		menu.addItem((item) =>
			item.setTitle(request.entry.title).setIcon(request.entry.iconId).onClick(request.entry.onClick),
		);
		menu.showAtMouseEvent(request.nativeEvent);
	}

	renderIcon(el: HTMLElement, iconId: string): void {
		setIcon(el, iconId);
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
