import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";

/** Copy + action for one destructive confirmation. */
export interface ConfirmModalOptions {
	readonly title: string;
	/** One or more sentences spelling out exactly what the action changes. */
	readonly body: string;
	/**
	 * Verbatim list of the user-authored content this action destroys, rendered
	 * so the user can see it even when the surface that normally shows it is
	 * hidden. Empty/absent → no list.
	 */
	readonly items?: readonly string[];
	/** Label of the destructive button — MUST restate the action, never "OK". */
	readonly confirmText: string;
	readonly onConfirm: () => void | Promise<void>;
}

/**
 * Generic "are you sure?" modal for destructive, wide-blast-radius actions
 * (error prevention: confirm before an irreversible bulk change).
 *
 * Deliberately dumb: it owns no domain knowledge, only copy + a callback, so a
 * second destructive action reuses it instead of hand-rolling another modal.
 * Cancel is the DEFAULT focus so a stray Enter cannot destroy anything, and the
 * red treatment is reserved for the confirm step (never for the button that
 * opens this modal).
 */
export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private readonly options: ConfirmModalOptions,
	) {
		super(app);
	}

	override onOpen(): void {
		this.setTitle(this.options.title);
		this.contentEl.createEl("p", { text: this.options.body });
		this.renderItems();
		new Setting(this.contentEl)
			.addButton((button) =>
				button
					.setButtonText("Cancel")
					.onClick(() => this.close())
					// Safe option holds initial focus (Enter/Escape both back out).
					// WHY-NOT `focus({ focusVisible: true })` to also show the ring:
					// not in TS's `FocusOptions` (needs a cast) and unverified in
					// this Electron build. The safety property holds regardless —
					// Enter on open cancels — so only the indicator is missing.
					.then(() => button.buttonEl.focus()),
			)
			.addButton((button) =>
				button
					.setButtonText(this.options.confirmText)
					.setWarning()
					.onClick(async () => {
						this.close();
						await this.options.onConfirm();
					}),
			);
	}

	/**
	 * The doomed content, verbatim and monospaced (it is usually code-ish — regexes,
	 * paths), scrollable so a long list cannot push the Cancel button off screen.
	 */
	private renderItems(): void {
		const items = this.options.items ?? [];
		if (items.length === 0) {
			return;
		}
		const list = this.contentEl.createEl("ul", { cls: "vicinity-graph-confirm-items" });
		for (const item of items) {
			list.createEl("li").createEl("code", { text: item });
		}
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
