import { describe, expect, it } from "vitest";
import { EngineDefaults, NODE_PREVIEW_PREFERENCES } from "../engine";
import type {
	SettingsNumberAccessor,
	SettingsTypedNumberAccessor,
	SettingsValueAccessor,
} from "./settingsRowAccessors";
import { SettingsRowAccessors } from "./settingsRowAccessors";
import type { SettingsRow, SettingsRowControl, SettingsRowState } from "./settingsRows";
import { EVERY_SETTINGS_ROW, unhandledRowControl } from "./settingsRows";
import type { SettingsInteraction } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";

/**
 * THE ACCESSOR CONTRACT, checked over EVERY DECLARED ROW rather than over a
 * hand-picked list: `read` and `interaction` must name the SAME field, and a numeric
 * accessor's `settlesAt` must promise exactly what the write path stores.
 *
 * WHY that is the property worth testing: an accessor is the one place a surface
 * learns where a row's value lives and which write moves it, so the failure it can
 * still have is an INTERNAL disagreement — reading `minPx` while writing `maxPx`, or
 * promising a clamp the pipeline does not apply. Both surfaces would then show a
 * control that silently snaps back, which is precisely what a source scan
 * (`settingsRowParity.test.ts`) cannot see.
 *
 * Driven off the declared rows and closed by {@link unhandledRowControl}, so a new
 * control kind cannot reach this file without saying which accessors it uses: an
 * unwired kind FAILS here instead of shipping untested.
 */

/** The globals every probe below starts from. */
function defaults(): SettingsRowState {
	return {
		globalDepths: EngineDefaults.depthSettings(),
		globalView: EngineDefaults.viewSettings(),
		nodeExclusion: EngineDefaults.nodeExclusionSettings(),
	};
}

/** Folds a planned command back into the globals, exactly as `SettingsWritePipeline` persists it. */
function applied(state: SettingsRowState, interaction: SettingsInteraction): SettingsRowState {
	const command = planSettingsWrite(interaction, state);
	switch (command.kind) {
		case "global-depths":
			return { ...state, globalDepths: command.depths };
		case "global-view":
			return { ...state, globalView: command.view };
		case "node-exclusion":
			return { ...state, nodeExclusion: command.nodeExclusion };
	}
}

/** One read → interaction → plan → read round trip. */
interface RoundTrip {
	/** What the accessor held before the write. */
	readonly previous: unknown;
	/** What `settlesAt` promised for the requested value. */
	readonly promised: unknown;
	/** What the accessor reads back once the planned command has landed. */
	readonly stored: unknown;
}

/** One accessor under test, with its value type erased by the binders below. */
interface AccessorProbe {
	readonly name: string;
	/** Re-writes the value the accessor already holds. */
	rewritesItsOwnValue(): RoundTrip;
	/** Writes a DIFFERENT value the accessor should end up holding. */
	writesANewValue(): RoundTrip;
	/** Numeric accessors only: writes a value beyond the declared bounds. */
	readonly writesBeyondItsBounds?: () => RoundTrip;
	/** Typed numeric accessors only: what the row counts as a typed value. */
	readonly accept?: (raw: string) => number | undefined;
}

function identity<T>(value: T): T {
	return value;
}

/**
 * Binds an accessor to its own value type — the only place `T` is known, which is
 * what lets the suite hold a heterogeneous list of probes without widening anything.
 */
function roundTripOf<T>(
	accessor: SettingsValueAccessor<T>,
	requested: T,
	settlesAt: (value: T) => T,
	state: SettingsRowState,
): RoundTrip {
	return {
		previous: accessor.read(state),
		promised: settlesAt(requested),
		stored: accessor.read(applied(state, accessor.interaction(requested))),
	};
}

function valueProbe<T>(name: string, accessor: SettingsValueAccessor<T>, distinct: (current: T) => T): AccessorProbe {
	return {
		name,
		rewritesItsOwnValue: () => roundTripOf(accessor, accessor.read(defaults()), identity, defaults()),
		writesANewValue: () => roundTripOf(accessor, distinct(accessor.read(defaults())), identity, defaults()),
	};
}

/** A value inside the declared bounds that is NOT the one the accessor already holds. */
function distinctInBounds(accessor: SettingsNumberAccessor, current: number): number {
	const { min, step } = accessor.bounds;
	return current === min ? min + step : min;
}

function numberProbe(name: string, accessor: SettingsNumberAccessor): AccessorProbe {
	// Far enough past the ceiling that any clamp must bite; `step` scales it to the
	// field's own units, so a 0–0.15 knob is probed as convincingly as a 1–1000 one.
	const BEYOND_BOUNDS_STEPS = 1000;
	const beyond = (accessor.bounds.max ?? accessor.bounds.min) + accessor.bounds.step * BEYOND_BOUNDS_STEPS;
	return {
		name,
		rewritesItsOwnValue: () => roundTripOf(accessor, accessor.read(defaults()), accessor.settlesAt, defaults()),
		writesANewValue: () =>
			roundTripOf(accessor, distinctInBounds(accessor, accessor.read(defaults())), accessor.settlesAt, defaults()),
		writesBeyondItsBounds: () => roundTripOf(accessor, beyond, accessor.settlesAt, defaults()),
	};
}

function typedNumberProbe(name: string, accessor: SettingsTypedNumberAccessor): AccessorProbe {
	return { ...numberProbe(name, accessor), accept: accessor.accept };
}

/** A preference that is not the one passed in — enough to prove the write moved something. */
function otherPreference(current: (typeof NODE_PREVIEW_PREFERENCES)[number]): (typeof NODE_PREVIEW_PREFERENCES)[number] {
	const other = NODE_PREVIEW_PREFERENCES.find((preference) => preference !== current);
	if (other === undefined) {
		throw new Error("the preview pill declares only one option");
	}
	return other;
}

/**
 * The accessors each control kind is rendered from — the SAME calls both presenters
 * make. A `switch` closed by {@link unhandledRowControl}, so a new kind is a compile
 * error here.
 */
function probesFor(control: SettingsRowControl): readonly AccessorProbe[] {
	switch (control.kind) {
		case "depth":
			return [numberProbe(control.field, SettingsRowAccessors.depth(control.field))];
		case "sizing-metric":
			return [
				valueProbe(`${control.metric} enabled`, SettingsRowAccessors.metricEnabled(control.metric), (on) => !on),
				typedNumberProbe(`${control.metric} weight`, SettingsRowAccessors.metricWeight(control.metric)),
			];
		case "sizing-number":
			return [typedNumberProbe(control.field, SettingsRowAccessors.sizingNumber(control.field))];
		case "node-preview":
			return [valueProbe("node preview", SettingsRowAccessors.nodePreview(), otherPreference)];
		case "outline-depth":
			return [numberProbe("outline depth", SettingsRowAccessors.outlineDepth())];
		case "force-layout":
			return [numberProbe(control.field, SettingsRowAccessors.forceLayout(control.field))];
		case "exclusion-enabled":
			return [valueProbe("exclusion enabled", SettingsRowAccessors.exclusionEnabled(), (on) => !on)];
		case "exclusion-patterns":
			return [valueProbe("exclusion patterns", SettingsRowAccessors.exclusionPatterns(), () => ["^probe/"])];
		case "node-cap":
			return [typedNumberProbe("node cap", SettingsRowAccessors.nodeCap())];
		default:
			return unhandledRowControl(control);
	}
}

const EVERY_PROBE: readonly AccessorProbe[] = EVERY_SETTINGS_ROW.flatMap((row: SettingsRow) => probesFor(row.control));

/** A round trip's verdict as a failure line, or `undefined` when it held. */
function mismatch(name: string, trip: RoundTrip): string | undefined {
	if (JSON.stringify(trip.stored) === JSON.stringify(trip.promised)) {
		return undefined;
	}
	return `${name}: wrote=[${JSON.stringify(trip.promised)}] but read back=[${JSON.stringify(trip.stored)}]`;
}

describe("settings row accessors: read and interaction name the same field", () => {
	it("WHEN an accessor re-writes the value it just read THEN a fresh read returns that same value", () => {
		// The cheapest way an accessor can be wrong: reading one field and writing another.
		// The identity round trip catches it without knowing anything about the field.
		expect(EVERY_PROBE.flatMap((probe) => mismatch(probe.name, probe.rewritesItsOwnValue()) ?? [])).toEqual([]);
	});

	it("WHEN an accessor writes a NEW value THEN a fresh read returns exactly what it wrote", () => {
		expect(EVERY_PROBE.flatMap((probe) => mismatch(probe.name, probe.writesANewValue()) ?? [])).toEqual([]);
	});

	it("WHEN a probe writes a new value THEN that value really differs from the stored one (not vacuous)", () => {
		const unmoved = EVERY_PROBE.map((probe) => ({ probe, trip: probe.writesANewValue() })).filter(
			({ trip }) => JSON.stringify(trip.promised) === JSON.stringify(trip.previous),
		);
		expect(unmoved.map(({ probe }) => probe.name)).toEqual([]);
	});
});

describe("settings row accessors: settlesAt promises what the write path stores", () => {
	it("WHEN a numeric accessor is handed a value beyond its bounds THEN the stored value is the one it promised", () => {
		// This is the property the panel's optimistic controls depend on: a control that
		// waits to be echoed a value the write path never stores stays stuck showing it.
		const trips = EVERY_PROBE.flatMap((probe) =>
			probe.writesBeyondItsBounds === undefined ? [] : [mismatch(probe.name, probe.writesBeyondItsBounds()) ?? []],
		);
		expect(trips.flat()).toEqual([]);
	});

	it("WHEN the bounds probe runs THEN it found numeric accessors to probe (not vacuous)", () => {
		expect(EVERY_PROBE.filter((probe) => probe.writesBeyondItsBounds !== undefined).length).toBeGreaterThan(0);
	});
});

describe("settings row accessors: a typed row says what counts as a typed value", () => {
	const TYPED: readonly AccessorProbe[] = EVERY_PROBE.filter((probe) => probe.accept !== undefined);

	it("WHEN a typed numeric row is mid-edit THEN it accepts nothing, so no half-entry is written", () => {
		const HALF_TYPED: readonly string[] = ["", "-", "abc"];
		const accepted = TYPED.flatMap((probe) =>
			HALF_TYPED.filter((raw) => probe.accept?.(raw) !== undefined).map((raw) => `${probe.name} accepted raw=[${raw}]`),
		);
		expect(accepted).toEqual([]);
	});

	it("WHEN the typed-row walk runs THEN it found typed rows to check (not vacuous)", () => {
		expect(TYPED.length).toBeGreaterThan(0);
	});
});

describe("settings row accessors cover every declared row", () => {
	it("WHEN a row is declared THEN at least one accessor renders it", () => {
		expect(EVERY_SETTINGS_ROW.filter((row) => probesFor(row.control).length === 0)).toEqual([]);
	});

	it("WHEN the rows are walked THEN there are more accessors than rows (the metric rows carry two)", () => {
		expect(EVERY_PROBE.length).toBeGreaterThan(EVERY_SETTINGS_ROW.length);
	});
});
