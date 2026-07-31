import type { App } from "obsidian";
import { LinkPreviewModal } from "./LinkPreviewModal";
import type { LinkPreviewModel } from "./linkPreviewModel";
import type { GraphUiPort, LinkPreviewPort, NoteOpenPort } from "./viewPorts";

/**
 * The obsidian side of {@link LinkPreviewPort}: hosts a built model in a fresh
 * {@link LinkPreviewModal}. One modal per show — Obsidian modals are one-shot
 * (`onClose` tears the React root down), so reuse would re-open a dead root.
 * Obsidian-coupled ⇒ e2e/smoke-covered, like {@link ObsidianGraphUi}.
 */
export class ObsidianLinkPreview implements LinkPreviewPort {
	constructor(
		private readonly app: App,
		/** Icon rendering only — the modal needs no other graph UI service. */
		private readonly ui: Pick<GraphUiPort, "renderIcon">,
		private readonly noteOpener: NoteOpenPort,
	) {}

	showLinkPreview(model: LinkPreviewModel): void {
		new LinkPreviewModal(this.app, model, this.ui, this.noteOpener).open();
	}
}
