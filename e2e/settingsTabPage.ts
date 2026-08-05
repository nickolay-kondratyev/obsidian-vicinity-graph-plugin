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

	/** The plugin's root element in the settings modal — also the tab's scroll container. */
	root(): Locator {
		return this.page.locator(".vicinity-graph-settings");
	}

	/**
	 * A control anywhere in the tab, by the accessible name the tab gives it.
	 *
	 * Accessible name, never a CSS path: `SettingsRowNames` IS the naming convention
	 * both surfaces apply (`src/view/settingsRows.ts`), so a spec that asks for a
	 * control by its declared name fails when the name drifts — which is the point.
	 */
	control(accessibleName: string): Locator {
		return this.root().getByLabel(accessibleName);
	}

	/** The `.setting-item` row that holds a control — a row is addressed by what it contains. */
	rowHolding(accessibleName: string): Locator {
		return this.root().locator(".setting-item", {
			has: this.page.locator(`[aria-label="${accessibleName}"]`),
		});
	}

	/**
	 * One row's inline feedback slot — the rejection / warning line a typed input shows.
	 *
	 * Scoped THROUGH `.setting-item-description` on purpose: the slot is created inside
	 * the row's `descEl` (`VicinityGraphSettingTab.addFeedbackSlot`), and "the message
	 * appears under the row it is about" is half of what makes it usable. A locator that
	 * only said `.vicinity-graph-settings-error` would pass with the slot rendered
	 * anywhere on the page.
	 *
	 * Empty text hides it via CSS `:empty`, so `toBeVisible()` / `toBeHidden()` here
	 * reads as "this row has something to say" / "it has nothing to say".
	 */
	feedbackUnder(accessibleName: string): Locator {
		return this.rowHolding(accessibleName).locator(".setting-item-description .vicinity-graph-settings-error");
	}

	/**
	 * Types `text` into a named control, replacing whatever it held.
	 *
	 * `fill` rather than `type`: it delivers ONE `input` event with the final text, so a
	 * multi-character value cannot be judged (and rejected) on a half-typed prefix — the
	 * per-keystroke path is `settingsDebounce.test.ts`'s business, while a spec here is
	 * about what a FINISHED entry does.
	 */
	async typeInto(accessibleName: string, text: string): Promise<void> {
		await this.control(accessibleName).fill(text);
	}

	/**
	 * Takes focus off a named control — the user leaving a field they finished typing
	 * in, which the tab treats as "persist it now" (`VicinityGraphSettingTab.flushOnBlur`).
	 *
	 * Its own method rather than "click somewhere else": clicking another typed row
	 * would blur this one AND schedule a write of its own, so the blur under test
	 * would no longer be the only thing that could have flushed.
	 */
	async blur(accessibleName: string): Promise<void> {
		await this.control(accessibleName).blur();
	}

	/**
	 * One framed section card, addressed by its heading text.
	 *
	 * Matched against the card's `.setting-item-heading` (what `setHeading()` renders —
	 * a styled div, NOT an aria heading, so `getByRole("heading")` cannot find it),
	 * with `exact: true`. A bare `hasText` over the card would be a substring match
	 * over the whole subtree — `card("Depth")` then also matches the card holding
	 * the "Outline depth" row.
	 */
	card(headingText: string): Locator {
		return this.page.locator(".vicinity-graph-settings-section", {
			has: this.page.locator(".setting-item-heading").getByText(headingText, { exact: true }),
		});
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
