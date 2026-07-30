import { describe, expect, it } from "vitest";
import { MAX_STEPPER_DEPTH, MIN_STEPPER_DEPTH } from "../engine";
import { SettingsRowAccessors } from "./settingsRowAccessors";
import { settingsRowsFor } from "./settingsRows";

/**
 * THE depth clamp — every behavior the former `clampStepperDepth` (src/view/constants.ts)
 * carried, now asserted through the accessor that owns it
 * (`SettingsRowAccessors.depth(field).settlesAt`). Same inputs, same expected numbers:
 * the clamp MOVED, it was not relaxed.
 *
 * WHY it moved: a depth write is stored VERBATIM by `planSettingsWrite`, so this is the
 * only clamp a depth ever gets — and it must therefore be derived from the same bounds
 * the control offers. The second describe below is the one that would have caught the
 * arrangement this replaced, where the bounds were per-field while the clamp was
 * hard-wired to `linkDepthOut`.
 */

/** The field the shipped `MIN/MAX_STEPPER_DEPTH` constants are projected from. */
const clamp = SettingsRowAccessors.depth("linkDepthOut").settlesAt;

describe("depth clamp bounds", () => {
	it("WHEN value below min THEN it clamps up to min", () => {
		expect(clamp(-1)).toBe(MIN_STEPPER_DEPTH);
	});

	it("WHEN value equals min THEN it is unchanged", () => {
		expect(clamp(0)).toBe(0);
	});

	it("WHEN value is within range THEN it is unchanged", () => {
		expect(clamp(3)).toBe(3);
	});

	it("WHEN value equals max THEN it is unchanged", () => {
		expect(clamp(5)).toBe(MAX_STEPPER_DEPTH);
	});

	it("WHEN value above max THEN it clamps down to max", () => {
		expect(clamp(6)).toBe(MAX_STEPPER_DEPTH);
	});

	it("WHEN value is fractional THEN it rounds to the nearest integer", () => {
		expect(clamp(2.4)).toBe(2);
	});
});

describe("depth clamp agrees with the track each depth row offers", () => {
	/** Every declared depth row's accessor, beside the field it edits. */
	const accessors = settingsRowsFor("depth").map((row) => {
		if (row.control.kind !== "depth") {
			throw new Error(`settingsRowsFor returned a non-depth row label=[${row.label}]`);
		}
		return { field: row.control.field, accessor: SettingsRowAccessors.depth(row.control.field) };
	});

	it("WHEN a depth row offers a track THEN its own clamp leaves both endpoints reachable", () => {
		// The failure this catches: a per-field bound the clamp does not know about. The
		// control would offer a value the write path silently takes back — invisible to every
		// other suite, because `planSettingsWrite` stores a depth verbatim.
		const unreachable = accessors.flatMap(({ field, accessor }) =>
			[accessor.bounds.min, accessor.bounds.max]
				.filter((endpoint) => accessor.settlesAt(endpoint) !== endpoint)
				.map((endpoint) => `${field}: offers ${endpoint}, clamp moves it to ${accessor.settlesAt(endpoint)}`),
		);
		expect(unreachable).toEqual([]);
	});

	it("WHEN the depth rows are walked THEN there is more than one (the guard is not vacuous)", () => {
		expect(accessors.length).toBeGreaterThan(1);
	});
});
