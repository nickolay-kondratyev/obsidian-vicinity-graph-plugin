import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { PLUGIN_ID } from "./obsidianHarness";
import { SETTINGS_TAB_SECTIONS } from "./settingsBaseline";

/**
 * Page object for the plugin's tab inside Obsidian's settings window: opening it,
 * re-rendering it, and naming the things a spec points at (a section card, its
 * scoped restore button, the confirmation dialog).
 *
 * WHY it exists: `settingsResetReview`, `settingsResetVerify` and
 * `settingsUxVisual` each carried their own copy of `openSettingsTab` / `card` /
 * `resetButton` / `confirmDialog`, and the copies had already drifted (only two
 * of the three waited for the tab to finish rendering). One object, one behavior.
 *
 * This module is pure page automation: NO `fs`, deliberately. Every top-level
 * `e2e/*.ts` is source-scanned by `vaultTarget.test.ts` for destructive writes,
 * and the cheapest way to satisfy that scan is to have nothing to scan. Each spec
 * keeps its own `OUT_DIR` for screenshots.
 */
export class SettingsTabPage {
	constructor(private readonly page: Page) {}

	/**
	 * Opens Obsidian's settings window on the plugin's tab and waits for it to be
	 * fully rendered.
	 *
	 * The wait is part of the contract, not a caller's concern: `openTabById`
	 * returns before the tab's `display()` has painted, so a locator resolved
	 * immediately after can match a half-built (or the previous tab's) DOM.
	 */
	async open(): Promise<void> {
		await this.page.evaluate((pluginId) => {
			const app = (window as unknown as { app: any }).app;
			app.setting.open();
			app.setting.openTabById(pluginId);
		}, PLUGIN_ID);
		await expect(this.page.locator(".vicinity-graph-settings-section")).toHaveCount(SETTINGS_TAB_SECTIONS.length);
	}

	/** Closes the whole settings window (e.g. to leave a single radiogroup in the document). */
	async close(): Promise<void> {
		await this.page.evaluate(() => (window as unknown as { app: any }).app.setting.close());
	}

	/**
	 * Re-runs the active settings tab's `display()`, so a store write made behind
	 * the UI's back shows up in the rendered rows. `?.` because the window may be
	 * closed — then there is nothing to re-render and that is not an error.
	 */
	async redisplay(): Promise<void> {
		await this.page.evaluate(() => (window as unknown as { app: any }).app.setting.activeTab?.display());
	}

	/** One framed section card, addressed by its heading text. */
	card(headingText: string): Locator {
		return this.page.locator(".vicinity-graph-settings-section", { hasText: headingText });
	}

	/** That card's own scoped restore button. */
	resetButton(headingText: string): Locator {
		return this.card(headingText).locator(".vicinity-graph-settings-reset button");
	}

	/** The tab-wide restore row (name + description + button). */
	resetAllRow(): Locator {
		return this.page.locator(".vicinity-graph-settings-reset-all");
	}

	/** The tab-wide restore button. */
	resetAllButton(): Locator {
		return this.resetAllRow().locator("button");
	}

	/**
	 * Obsidian's settings window is ITSELF a `.modal-container`, so our confirmation
	 * is always the LAST one (a bare `.modal-container` locator is a strict-mode
	 * violation here).
	 */
	confirmDialog(): Locator {
		return this.openModals().last();
	}

	/** A button inside {@link confirmDialog}, addressed by its visible text. */
	dialogButton(text: string): Locator {
		return this.confirmDialog().locator("button").filter({ hasText: text });
	}

	/**
	 * Every stacked modal, INCLUDING the settings window itself — which is what
	 * makes it the "no confirmation was raised" assertion: a count of 1 means only
	 * the settings window is open.
	 */
	openModals(): Locator {
		return this.page.locator(".modal-container");
	}
}
