import type { ReactElement } from "react";
import type { ForceLayoutSettings, ViewSettings } from "../engine";
import { FORCE_LAYOUT_RANGES } from "../engine";
import { useControlsActions } from "./ControlsActionsContext";
import { Disclosure } from "./Disclosure";
import {
	FORCE_LAYOUT_ADVANCED_FIELDS,
	FORCE_LAYOUT_FIELD_META,
	FORCE_LAYOUT_MAIN_FIELDS,
} from "./forceLayoutFieldMeta";
import { useOptimisticValue } from "./useOptimisticValue";

/**
 * The in-graph force-layout mirror: full settings-tab parity (the
 * native-parity sliders, the "Advanced spacing" knobs behind a nested
 * disclosure, and Restore defaults) driven by the SAME shared sources —
 * bounds from the engine's {@link FORCE_LAYOUT_RANGES}, copy from
 * {@link FORCE_LAYOUT_FIELD_META}, writes through the one
 * `global-force-layout-field` interaction. Every drag rebuilds live: the
 * GraphStructureDiff forces a relayout whenever a force field changes.
 *
 * Each slider names ONLY its own field; the pipeline merges it over the six
 * sibling knobs as they are STORED. Sending the whole object from here (what this
 * section used to do) meant a second drag started from the object this render
 * captured, silently undoing the first drag — the settings tab's sliders had
 * already been fixed this way.
 *
 * The 260px panel has no room for the settings tab's full description text, so
 * each slider carries it as a native `title` tooltip instead (same copy, zero
 * drift), with the current value read out beside the label as drag feedback.
 */
export function ForceLayoutSection({ view }: { readonly view: ViewSettings }): ReactElement {
	const actions = useControlsActions();
	/**
	 * The SAME plan the settings tab's "Restore force layout defaults" row runs —
	 * the scope name goes to the pipeline, which calls `planSettingsReset`. Building
	 * defaults here would make the panel a second opinion on what a force-layout
	 * default is (guarded by `engineDefaultsSingleSource.test.ts`).
	 *
	 * WHY-NOT a confirmation: the panel has no confirm modal, and the force-layout
	 * scope declares none — pinned for every non-exclusion section scope at once by
	 * `settingsResetPlan.test.ts` — so nothing is skipped.
	 */
	const restoreDefaults = (): void => void actions.restoreDefaults("force-layout");
	const slider = (field: keyof ForceLayoutSettings): ReactElement => (
		<ForceLayoutSlider key={field} field={field} value={view.forceLayout[field]} />
	);

	return (
		<Disclosure summary="Force layout" className="vicinity-graph-forcelayout">
			{FORCE_LAYOUT_MAIN_FIELDS.map(slider)}
			<Disclosure summary="Advanced spacing" className="vicinity-graph-forcelayout__advanced">
				{FORCE_LAYOUT_ADVANCED_FIELDS.map(slider)}
			</Disclosure>
			<button
				type="button"
				className="vicinity-graph-forcelayout__restore"
				title="Reset all force layout sliders to their shipped defaults."
				onClick={restoreDefaults}
			>
				Restore defaults
			</button>
		</Disclosure>
	);
}

/**
 * One labelled range slider: bounds from the shared range table, copy from the
 * shared meta table. Optimistic (see {@link useOptimisticValue}) because a drag
 * emits a value per pointer move — reading them back off the rebuild would make
 * the thumb stutter behind the pointer.
 */
function ForceLayoutSlider({
	field,
	value,
}: {
	readonly field: keyof ForceLayoutSettings;
	readonly value: number;
}): ReactElement {
	const actions = useControlsActions();
	const range = FORCE_LAYOUT_RANGES[field];
	const meta = FORCE_LAYOUT_FIELD_META[field];
	const [shown, request] = useOptimisticValue(value, (next) =>
		actions.applySettings({ kind: "global-force-layout-field", field, value: next }),
	);
	return (
		<label className="vicinity-graph-forcelayout__field" title={meta.description}>
			<span className="vicinity-graph-forcelayout__head">
				<span className="vicinity-graph-forcelayout__label">{meta.label}</span>
				<span className="vicinity-graph-forcelayout__value">{shown}</span>
			</span>
			{/* `slider` is Obsidian's own class for range inputs — inherits the native themed track/thumb. */}
			<input
				type="range"
				className="slider"
				aria-label={meta.label}
				min={range.min}
				max={range.max}
				step={range.step}
				value={shown}
				onChange={(event) => {
					if (!Number.isNaN(event.target.valueAsNumber)) {
						request(event.target.valueAsNumber);
					}
				}}
			/>
		</label>
	);
}
