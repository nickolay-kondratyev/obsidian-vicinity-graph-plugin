import type { ReactElement } from "react";
import type { ForceLayoutSettings, ViewSettings } from "../engine";
import { EngineDefaults, FORCE_LAYOUT_RANGES } from "../engine";
import { useControlsActions } from "./ControlsActionsContext";
import { Disclosure } from "./Disclosure";
import {
	FORCE_LAYOUT_ADVANCED_FIELDS,
	FORCE_LAYOUT_FIELD_META,
	FORCE_LAYOUT_MAIN_FIELDS,
} from "./forceLayoutFieldMeta";
import type { SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";

/**
 * The in-graph force-layout mirror: full settings-tab parity (the
 * native-parity sliders, the "Advanced spacing" knobs behind a nested
 * disclosure, and Restore defaults) driven by the SAME shared sources —
 * bounds from the engine's {@link FORCE_LAYOUT_RANGES}, copy from
 * {@link FORCE_LAYOUT_FIELD_META}, writes through the existing
 * `global-force-layout` interaction. Every drag rebuilds live: the
 * GraphStructureDiff forces a relayout whenever a force field changes.
 *
 * The 260px panel has no room for the settings tab's full description text, so
 * each slider carries it as a native `title` tooltip instead (same copy, zero
 * drift), with the current value read out beside the label as drag feedback.
 */
export function ForceLayoutSection({
	view,
	ctx,
}: {
	readonly view: ViewSettings;
	readonly ctx: SettingsWriteContext;
}): ReactElement {
	const actions = useControlsActions();
	const apply = (forceLayout: ForceLayoutSettings): void => {
		void actions.applySettings(planSettingsWrite({ kind: "global-force-layout", forceLayout }, ctx));
	};
	const slider = (field: keyof ForceLayoutSettings): ReactElement => (
		<ForceLayoutSlider
			key={field}
			field={field}
			value={view.forceLayout[field]}
			onChange={(value) => apply({ ...view.forceLayout, [field]: value })}
		/>
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
				onClick={() => apply(EngineDefaults.forceLayoutSettings())}
			>
				Restore defaults
			</button>
		</Disclosure>
	);
}

/** One labelled range slider: bounds from the shared range table, copy from the shared meta table. */
function ForceLayoutSlider({
	field,
	value,
	onChange,
}: {
	readonly field: keyof ForceLayoutSettings;
	readonly value: number;
	readonly onChange: (value: number) => void;
}): ReactElement {
	const range = FORCE_LAYOUT_RANGES[field];
	const meta = FORCE_LAYOUT_FIELD_META[field];
	return (
		<label className="vicinity-graph-forcelayout__field" title={meta.description}>
			<span className="vicinity-graph-forcelayout__head">
				<span className="vicinity-graph-forcelayout__label">{meta.label}</span>
				<span className="vicinity-graph-forcelayout__value">{value}</span>
			</span>
			{/* `slider` is Obsidian's own class for range inputs — inherits the native themed track/thumb. */}
			<input
				type="range"
				className="slider"
				aria-label={meta.label}
				min={range.min}
				max={range.max}
				step={range.step}
				value={value}
				onChange={(event) => {
					if (!Number.isNaN(event.target.valueAsNumber)) {
						onChange(event.target.valueAsNumber);
					}
				}}
			/>
		</label>
	);
}
