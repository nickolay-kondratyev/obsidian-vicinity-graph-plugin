import { Modal } from "obsidian";
import type { App } from "obsidian";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import { LinkPreviewContent } from "./LinkPreviewContent";
import type { LinkPreviewGoTarget } from "./LinkPreviewContent";
import type { LinkPreviewModel } from "./linkPreviewModel";
import type { GraphUiPort, NoteOpenPort } from "./viewPorts";

/**
 * The link-preview modal (parent ticket `nid_tohotgq2s92dvd1iov1rd0umv_e`): an
 * Obsidian `Modal` (precedent: {@link ConfirmModal}) hosting a React 18 root
 * that renders a built {@link LinkPreviewModel} via {@link LinkPreviewContent}.
 *
 * Deliberately thin — build the model BEFORE constructing the modal (the
 * occurrence queries are async; a modal that loads would need a spinner state
 * this surface doesn't want). All behaviour lives in the node-testable content
 * component; this class only owns the Obsidian chrome and the GO side effects.
 * Obsidian-coupled ⇒ e2e-covered, like every `Obsidian*`/modal class here.
 */
export class LinkPreviewModal extends Modal {
	private root: Root | null = null;

	constructor(
		app: App,
		private readonly model: LinkPreviewModel,
		/** Icon rendering only — the modal needs no other graph UI service. */
		private readonly ui: Pick<GraphUiPort, "renderIcon">,
		private readonly noteOpener: NoteOpenPort,
	) {
		super(app);
	}

	override onOpen(): void {
		this.setTitle(this.title());
		this.modalEl.addClass("vicinity-graph-link-preview-modal");
		this.root = createRoot(this.contentEl);
		this.root.render(
			<LinkPreviewContent
				model={this.model}
				renderIcon={(el, iconId) => this.ui.renderIcon(el, iconId)}
				onGo={(target) => this.go(target)}
			/>,
		);
	}

	override onClose(): void {
		this.root?.unmount();
		this.root = null;
		this.contentEl.empty();
	}

	/** Modal closes on GO (ticket requirement) — the editor takes over. */
	private go(target: LinkPreviewGoTarget): void {
		this.close();
		this.noteOpener.openNote(target.path, { newTab: false, line: target.line });
	}

	private title(): string {
		return this.model.kind === "node"
			? VaultPathFacts.titleOf(this.model.path)
			: `${VaultPathFacts.titleOf(this.model.sourcePath)} → ${VaultPathFacts.titleOf(this.model.targetPath)}`;
	}
}
