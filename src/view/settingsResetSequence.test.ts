import { describe, expect, it } from "vitest";
import type { SettingsResetScope } from "./settingsResetPlan";
import type { SettingsResetTarget } from "./settingsResetSequence";
import { SettingsResetSequence } from "./settingsResetSequence";

/**
 * The ORDER a restore-defaults happens in — the whole reason this class exists.
 *
 * The bug it replaces (`nid_8b97fdqznqsncc5kgya1p871w_e`): the settings tab called
 * `display()` from INSIDE the queued reset task, so a control the user clicked
 * while the reset was in flight had its write queued BEHIND the rebuild. The tab
 * then showed post-reset values while a write the user had actually asked for was
 * still landing.
 *
 * `SettingsResetTarget` is a port precisely so this order is testable: the tab
 * itself has no vitest harness (node env, no jsdom, `obsidian` is types-only).
 */

/** Records what the sequence did, in order, and lets a test act DURING a step. */
class FakeResetTarget implements SettingsResetTarget {
	readonly steps: string[] = [];
	/** Ran inside `writeDefaults`, standing in for a control clicked mid-reset. */
	duringWrite: () => void = () => undefined;
	/** Writes still queued when `drainWrites` was called; drained by it, like the real chain. */
	private queued: string[] = [];

	async flushTypedEdits(): Promise<void> {
		this.steps.push("flush");
	}

	async writeDefaults(scope: SettingsResetScope): Promise<void> {
		this.steps.push(`write-defaults:${scope}`);
		this.duringWrite();
	}

	async drainWrites(): Promise<void> {
		this.steps.push(...this.queued);
		this.queued = [];
	}

	redisplay(): void {
		this.steps.push("redisplay");
	}

	/** A write enqueued by "the user" — it lands when the chain is drained, not before. */
	enqueueWriteBehindTheReset(label: string): void {
		this.queued.push(label);
	}
}

function sequenceUnderTest() {
	const target = new FakeResetTarget();
	return { target, sequence: new SettingsResetSequence(target) };
}

describe("SettingsResetSequence", () => {
	it("WHEN a control is clicked while the reset is writing THEN the redisplay happens AFTER that write", async () => {
		const { target, sequence } = sequenceUnderTest();
		target.duringWrite = () => target.enqueueWriteBehindTheReset("click-write");
		await sequence.run("all");
		expect(target.steps.indexOf("click-write")).toBeLessThan(target.steps.indexOf("redisplay"));
	});

	it("WHEN a reset runs THEN typed edits are flushed BEFORE the defaults are written", async () => {
		// A keystroke still inside the settle window would otherwise land after the
		// defaults and silently un-reset its field.
		const { target, sequence } = sequenceUnderTest();
		await sequence.run("node-sizing");
		expect(target.steps.indexOf("flush")).toBeLessThan(target.steps.indexOf("write-defaults:node-sizing"));
	});

	it("WHEN a reset runs THEN typed edits are flushed AGAIN after the defaults, before the redisplay", async () => {
		// A field typed into WHILE the reset ran is still inside its settle window; the
		// redisplay reads the store synchronously, so that edit has to land first.
		const { target, sequence } = sequenceUnderTest();
		await sequence.run("all");
		expect(target.steps).toEqual(["flush", "write-defaults:all", "flush", "redisplay"]);
	});

	it("WHEN the reset write fails THEN the tab is still redisplayed (it must show what the store holds)", async () => {
		const { target, sequence } = sequenceUnderTest();
		target.writeDefaults = () => Promise.reject(new Error("disk full"));
		await sequence.run("all");
		expect(target.steps).toContain("redisplay");
	});

	it("WHEN the reset write fails THEN a write queued behind it is STILL drained before the redisplay", async () => {
		// The failure path is where the bug this class exists to prevent hides: a failed
		// `data.json` write must not turn the drain into a step that is skipped, or the
		// redisplay reads the globals with the user's own click still queued.
		const { target, sequence } = sequenceUnderTest();
		target.writeDefaults = () => {
			target.enqueueWriteBehindTheReset("click-write");
			return Promise.reject(new Error("disk full"));
		};
		await sequence.run("all");
		expect(target.steps).toEqual(["flush", "flush", "click-write", "redisplay"]);
	});
});
