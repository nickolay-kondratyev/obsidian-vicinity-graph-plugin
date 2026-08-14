import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import { SETTINGS_RESET_SCOPES } from "./settingsResetPlan";
import type { SettingsValueAccessor } from "./settingsRowAccessors";
import { SettingsRowAccessors } from "./settingsRowAccessors";
import type { SettingsRowControl, SettingsRowState } from "./settingsRows";
import { EVERY_SETTINGS_ROW, unhandledRowControl } from "./settingsRows";
import { SettingsWriteFailureNotice } from "./settingsWriteFailureNotice";
import type { SettingsInteraction } from "./settingsWritePlan";

/**
 * The notice must name the setting the user just touched — that name is the whole
 * value of the message, so these tests pin the COPY (the literal row labels) rather
 * than re-deriving it from the row model, which would assert nothing.
 *
 * One case per lookup shape: a field-bearing control (three depth rows share a kind,
 * so keying on the kind alone would label them all "Links out") and a field-less one.
 */
describe("SettingsWriteFailureNotice for an interaction", () => {
	it("WHEN a depth write fails THEN the notice names THAT depth row, not another one sharing its kind", () => {
		const notice = SettingsWriteFailureNotice.forInteraction({ kind: "global-depth", field: "linkDepthIn", value: 2 });
		expect(notice).toContain("Links in");
	});

	it("WHEN a field-less control's write fails THEN the notice names its row", () => {
		const notice = SettingsWriteFailureNotice.forInteraction({ kind: "global-cap", value: 42 });
		expect(notice).toContain("Node cap");
	});

	it("WHEN any write fails THEN the notice attributes itself to this plugin", () => {
		// Obsidian notices carry no chrome: an unattributed one reads as the app's own.
		const notice = SettingsWriteFailureNotice.forInteraction({ kind: "global-cap", value: 42 });
		expect(notice).toContain("Vicinity graph");
	});

	it("WHEN any write fails THEN the notice says the change is live this session but lost at restart", () => {
		// The store applies optimistically BEFORE the disk write, so every surface keeps
		// showing the new value after a rejected persist (decided in ticket
		// nid_biwdtykvazsk3ejcqqli8o9j7_e). The notice must agree with the screen: the
		// change is in effect, only its survival past restart is what failed.
		const notice = SettingsWriteFailureNotice.forInteraction({ kind: "global-cap", value: 42 });
		expect(notice).toContain("applies for this session but will be lost when Obsidian restarts");
	});
});

/**
 * THE TRIPWIRE, over every declared row: the subject must be a DECLARED label.
 *
 * WHY it is needed even though the spot-checks above pass: the lookup falls back to the
 * control's bare KIND when no row matches, so a miss does not fail — it SHIPS, as
 * `Vicinity graph couldn't save “force-layout”.` This walk makes that fallback
 * observable, and it is what pins `controlFor` (interaction → control) against
 * `controlKey` (control → lookup key) for every field of every kind: neither side alone
 * is compile-checked into naming the RIGHT control, only a well-typed one.
 *
 * Driven off the accessors because they are the ONLY producers of a
 * {@link SettingsInteraction} in the codebase — so this walk covers every interaction
 * any surface can actually emit, and no hand-written interaction can drift from them.
 * (A separate `switch` from `settingsRowAccessors.test.ts`'s `probesFor`: that one binds
 * each accessor's value type `T` to build round-trip probes, while this one needs only
 * the emitted interaction. Both are closed by {@link unhandledRowControl}, so a new
 * control kind cannot reach either file silently.)
 */
describe("SettingsWriteFailureNotice over every declared row", () => {
	/** The globals accessors read against — any value works, only the interaction SHAPE matters. */
	function defaults(): SettingsRowState {
		return {
			globalDepths: EngineDefaults.depthSettings(),
			globalView: EngineDefaults.viewSettings(),
			nodeExclusion: EngineDefaults.nodeExclusionSettings(),
			frontmatterLinks: EngineDefaults.frontmatterLinkSettings(),
		};
	}

	/** The interaction an accessor emits for the value it already holds. */
	function interactionOf<T>(accessor: SettingsValueAccessor<T>): SettingsInteraction {
		return accessor.interaction(accessor.read(defaults()));
	}

	/** Every interaction one row's controls can emit. */
	function interactionsFor(control: SettingsRowControl): readonly SettingsInteraction[] {
		switch (control.kind) {
			case "depth":
				return [interactionOf(SettingsRowAccessors.depth(control.field))];
			case "sizing-number":
				return [interactionOf(SettingsRowAccessors.sizingNumber(control.field))];
			case "node-preview":
				return [interactionOf(SettingsRowAccessors.nodePreview())];
			case "show-cross-links":
				return [interactionOf(SettingsRowAccessors.showCrossLinks())];
			case "group-label-full-path":
				return [interactionOf(SettingsRowAccessors.groupLabelFullPath())];
			case "outline-depth":
				return [interactionOf(SettingsRowAccessors.outlineDepth())];
			case "force-layout":
				return [interactionOf(SettingsRowAccessors.forceLayout(control.field))];
			case "exclusion-enabled":
				return [interactionOf(SettingsRowAccessors.exclusionEnabled())];
			case "exclusion-patterns":
				return [interactionOf(SettingsRowAccessors.exclusionPatterns())];
			case "node-cap":
				return [interactionOf(SettingsRowAccessors.nodeCap())];
			case "id-ref-fields":
				return [interactionOf(SettingsRowAccessors.idRefFields())];
			default:
				return unhandledRowControl(control);
		}
	}

	const EVERY_ROW_INTERACTION = EVERY_SETTINGS_ROW.flatMap((row) =>
		interactionsFor(row.control).map((interaction) => ({ row, interaction })),
	);

	it("WHEN any declared row's write fails THEN the notice names THAT row's declared label", () => {
		// Matched WITH the quotes the copy puts around the subject, so the assertion is an
		// exact-subject match: a row whose label merely CONTAINS another's cannot pass on it.
		const misnamed = EVERY_ROW_INTERACTION.flatMap(({ row, interaction }) => {
			const notice = SettingsWriteFailureNotice.forInteraction(interaction);
			return notice.includes(`“${row.label}”`)
				? []
				: [`${interaction.kind} on row=[${row.label}] produced notice=[${notice}]`];
		});
		expect(misnamed).toEqual([]);
	});

	it("WHEN the row walk runs THEN it found one interaction per row (no multi-control rows remain)", () => {
		// Without this the assertion above would pass a walk that found nothing to check.
		expect(EVERY_ROW_INTERACTION.length).toBe(EVERY_SETTINGS_ROW.length);
	});
});

describe("SettingsWriteFailureNotice for a reset", () => {
	it("WHEN a restore-defaults write fails THEN the notice names the DECLARED scope label", () => {
		// Derived on purpose: the point is that the notice's blast radius reads exactly
		// like the button's, whatever that label is changed to.
		expect(SettingsWriteFailureNotice.forReset("node-exclusion")).toContain(
			SETTINGS_RESET_SCOPES["node-exclusion"].label,
		);
	});
});
