import type { ReactElement } from "react";
import { useId } from "react";
import type { DepthSettings, ForceLayoutSettings, NodePreviewPreference, SizeMetricId } from "../engine";
import { NODE_PREVIEW_PREFERENCES } from "../engine";
import { useControlsActions } from "./ControlsActionsContext";
import { DepthStepper } from "./DepthStepper";
import { NODE_PREVIEW_OPTION_META } from "./nodePreviewPreferenceMeta";
import type {
	SettingsNumberAccessor,
	SettingsRowBounds,
	SettingsTypedNumberAccessor,
	SettingsValueAccessor,
} from "./settingsRowAccessors";
import { SettingsRowAccessors } from "./settingsRowAccessors";
import type { SettingsRow, SettingsRowState } from "./settingsRows";
import { SettingsRowNames, isSettingsRowDisabled, unhandledRowControl } from "./settingsRows";
import type { SizingNumberField } from "./settingsWritePlan";
import { ToggleSwitch } from "./ToggleSwitch";
import { useOptimisticValue } from "./useOptimisticValue";

/**
 * The in-graph controls panel's HALF of the settings row contract — the React twin
 * of `VicinityGraphSettingTab.addRow()`. Both switch EXHAUSTIVELY over
 * `SettingsRowControl`, closed by `unhandledRowControl`, so a control kind added to
 * `settingsRows.ts` fails to compile in BOTH presenters: that is what makes tab/panel
 * parity structural instead of remembered.
 *
 * Obsidian's `Setting` API cannot mount inside React, which is why the MARKUP is
 * duplicated at all. Everything a user reads or hears — label, description,
 * ordering, accessible name, `disabledWhen` — comes from the shared model, so the
 * duplication is presentation only.
 *
 * Panel-specific presentation rules, applied uniformly here:
 * - The 260px panel has no room for a row description, so it rides as a native
 *   `title` tooltip (same string, zero drift).
 * - Every control is OPTIMISTIC ({@link useOptimisticValue}) so it answers the
 *   interaction instead of waiting out a traversal + layout rebuild, and is handed
 *   the SAME clamp the write path applies where one exists.
 * - Every control names ONE field via a `SettingsInteraction` and hands it to the
 *   shared pipeline through {@link useControlsActions}; nothing here merges a slice
 *   from the snapshot it rendered from.
 *
 * The value read, the bounds and the interaction are NOT decided here either: every
 * arm below takes them from {@link SettingsRowAccessors}, the same accessors the
 * settings tab renders from. This file is markup plus one accessor call per kind.
 */

export function SettingsRowView({
	row,
	state,
}: {
	readonly row: SettingsRow;
	readonly state: SettingsRowState;
}): ReactElement {
	switch (row.control.kind) {
		case "depth":
			return <DepthRow row={row} field={row.control.field} state={state} />;
		case "sizing-metric":
			return <SizingMetricRow row={row} metric={row.control.metric} state={state} />;
		case "sizing-number":
			return <SizingNumberRow row={row} field={row.control.field} state={state} />;
		case "node-preview":
			return <NodePreviewRow row={row} state={state} />;
		case "outline-depth":
			return <OutlineDepthRow row={row} state={state} />;
		case "force-layout":
			return <ForceLayoutRow row={row} field={row.control.field} state={state} />;
		case "exclusion-enabled":
			return <ExclusionEnabledRow row={row} state={state} />;
		case "exclusion-patterns":
			return <ExclusionPatternsRow row={row} state={state} />;
		case "node-cap":
			return <NodeCapRow row={row} state={state} />;
		default:
			return unhandledRowControl(row.control);
	}
}

/* ========================================================================== *
 * Shared row shapes
 * ========================================================================== */

/**
 * Wires one accessor to the shared pipeline: what to SHOW, and the setter a control
 * calls on user input. The whole of a row component's non-markup behaviour.
 */
function useSettingsValue<T>(
	accessor: SettingsValueAccessor<T>,
	state: SettingsRowState,
	settlesAt?: (value: T) => T,
): readonly [T, (value: T) => void] {
	const actions = useControlsActions();
	return useOptimisticValue(
		accessor.read(state),
		(value) => actions.applySettings(accessor.interaction(value)),
		settlesAt,
	);
}

/**
 * A stacked label + value readout above a full-width native range input. The
 * inline readout replaces the settings tab's hover tooltip: a drag needs feedback
 * without a hover.
 *
 * Only declared on fields that HAVE an upper bound — see {@link SettingsRowBounds}.
 */
function SliderRow({
	row,
	accessor,
	state,
}: {
	readonly row: SettingsRow;
	readonly accessor: SettingsNumberAccessor;
	readonly state: SettingsRowState;
}): ReactElement {
	const range: SettingsRowBounds = accessor.bounds;
	const [shown, request] = useSettingsValue(accessor, state, accessor.settlesAt);
	return (
		<label className="vicinity-graph-slider-row" title={row.description}>
			<span className="vicinity-graph-slider-row__head">
				<span className="vicinity-graph-slider-row__label">{row.label}</span>
				<span className="vicinity-graph-slider-row__value">{shown}</span>
			</span>
			{/* `slider` is Obsidian's own class for range inputs — inherits the native themed track/thumb. */}
			<input
				type="range"
				className="slider"
				aria-label={SettingsRowNames.sole(row)}
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

/**
 * A label beside a narrow number field. The accessor's `accept` decides what counts
 * as a typed value — the `min` attribute alone only drives the steppers, never a
 * typed one.
 *
 * KNOWN LIMIT of refusing a write on a CONTROLLED input: a rejected keystroke leaves
 * the field showing the stored value, so the box cannot be emptied on the way to a new
 * number (select-and-retype works; backspacing to blank does not). The settings tab's
 * uncontrolled input keeps the text and only drops the write. Refusing an out-of-spec
 * write is the property worth keeping; the panel's numeric-entry feedback is the open
 * ticket `nid_hatwq2jlkhno5t6awcz0q6t9q_e`.
 */
function NumberRow({
	row,
	accessor,
	state,
}: {
	readonly row: SettingsRow;
	readonly accessor: SettingsTypedNumberAccessor;
	readonly state: SettingsRowState;
}): ReactElement {
	const [shown, request] = useSettingsValue(accessor, state, accessor.settlesAt);
	return (
		<label className="vicinity-graph-number-row" title={row.description}>
			<span>{row.label}</span>
			<input
				type="number"
				aria-label={SettingsRowNames.sole(row)}
				min={accessor.bounds.min}
				max={accessor.bounds.max}
				step={accessor.bounds.step}
				value={shown}
				onChange={(event) => {
					const parsed = accessor.accept(event.target.value);
					if (parsed !== undefined) {
						request(parsed);
					}
				}}
			/>
		</label>
	);
}

/* ========================================================================== *
 * One component per control kind
 * ========================================================================== */

/**
 * The panel presents a depth as a STEPPER rather than a slider: whole hops, two
 * taps, no pointer precision needed at 260px. The stepper clamps, so no
 * `settlesAt` is threaded here.
 */
function DepthRow({
	row,
	field,
	state,
}: {
	readonly row: SettingsRow;
	readonly field: keyof DepthSettings;
	readonly state: SettingsRowState;
}): ReactElement {
	const accessor = SettingsRowAccessors.depth(field);
	const actions = useControlsActions();
	return (
		<DepthStepper
			row={row}
			bounds={accessor.bounds}
			value={accessor.read(state)}
			onChange={(value) => actions.applySettings(accessor.interaction(value))}
		/>
	);
}

/** One metric: the enable toggle and the weight it governs — one decision, two controls. */
function SizingMetricRow({
	row,
	metric,
	state,
}: {
	readonly row: SettingsRow;
	readonly metric: SizeMetricId;
	readonly state: SettingsRowState;
}): ReactElement {
	const weightAccessor = SettingsRowAccessors.metricWeight(metric);
	const [enabled, requestEnabled] = useSettingsValue(SettingsRowAccessors.metricEnabled(metric), state);
	const [weight, requestWeight] = useSettingsValue(weightAccessor, state, weightAccessor.settlesAt);
	return (
		<div className="vicinity-graph-sizing__metric">
			<label className="vicinity-graph-sizing__toggle">
				<input
					type="checkbox"
					aria-label={SettingsRowNames.role(row, "enabled")}
					checked={enabled}
					onChange={(event) => requestEnabled(event.target.checked)}
				/>
				<span>{row.label}</span>
			</label>
			<input
				type="number"
				className="vicinity-graph-sizing__weight"
				aria-label={SettingsRowNames.role(row, "weight")}
				title="Weight"
				min={weightAccessor.bounds.min}
				max={weightAccessor.bounds.max}
				step={weightAccessor.bounds.step}
				value={weight}
				disabled={!enabled}
				onChange={(event) => {
					const parsed = weightAccessor.accept(event.target.value);
					if (parsed !== undefined) {
						requestWeight(parsed);
					}
				}}
			/>
		</div>
	);
}

function SizingNumberRow({
	row,
	field,
	state,
}: {
	readonly row: SettingsRow;
	readonly field: SizingNumberField;
	readonly state: SettingsRowState;
}): ReactElement {
	return <NumberRow row={row} accessor={SettingsRowAccessors.sizingNumber(field)} state={state} />;
}

function NodeCapRow({ row, state }: { readonly row: SettingsRow; readonly state: SettingsRowState }): ReactElement {
	return <NumberRow row={row} accessor={SettingsRowAccessors.nodeCap()} state={state} />;
}

function OutlineDepthRow({
	row,
	state,
}: {
	readonly row: SettingsRow;
	readonly state: SettingsRowState;
}): ReactElement {
	return <SliderRow row={row} accessor={SettingsRowAccessors.outlineDepth()} state={state} />;
}

function ForceLayoutRow({
	row,
	field,
	state,
}: {
	readonly row: SettingsRow;
	readonly field: keyof ForceLayoutSettings;
	readonly state: SettingsRowState;
}): ReactElement {
	return <SliderRow row={row} accessor={SettingsRowAccessors.forceLayout(field)} state={state} />;
}

/**
 * The Preview pill. Copy comes from the shared {@link NODE_PREVIEW_OPTION_META} and
 * the order from {@link NODE_PREVIEW_PREFERENCES}, so the two surfaces' pills cannot
 * drift.
 */
function NodePreviewRow({
	row,
	state,
}: {
	readonly row: SettingsRow;
	readonly state: SettingsRowState;
}): ReactElement {
	/*
	 * Radio grouping is DOCUMENT-scoped for inputs outside a `<form>`. The settings
	 * tab's pill uses its own constant name; this one must be unique per mount, or
	 * two open surfaces (or two graph views) would fuse into one group and un-check
	 * each other. `useId()` is exactly that guarantee — which is why the shared row
	 * model does NOT own the name.
	 */
	const groupName = useId();
	const [selected, request] = useSettingsValue<NodePreviewPreference>(SettingsRowAccessors.nodePreview(), state);
	const accessibleName = SettingsRowNames.sole(row);
	return (
		<div className="vicinity-graph-nodecontents__field">
			{/* A plain span, not a <label>: it names the GROUP (carried by the
			    radiogroup's aria-label), not any single radio. A bare
			    Auto/Outline/Image trio would not say what it switches. */}
			<span className="vicinity-graph-nodecontents__label">{row.label}</span>
			<div className="vicinity-graph-segmented" role="radiogroup" aria-label={accessibleName}>
				{NODE_PREVIEW_PREFERENCES.map((preference) => {
					const meta = NODE_PREVIEW_OPTION_META[preference];
					return (
						// The <label> WRAPS its radio, so the visible text is the radio's
						// accessible name with no id/for pairing. The panel has no room for
						// the row description, so the OPTION copy rides as a title tooltip.
						<label key={preference} className="vicinity-graph-segmented__option" title={meta.description}>
							<input
								type="radio"
								name={groupName}
								value={preference}
								checked={selected === preference}
								onChange={() => request(preference)}
							/>
							<span className="vicinity-graph-segmented__text">{meta.label}</span>
						</label>
					);
				})}
			</div>
		</div>
	);
}

function ExclusionEnabledRow({
	row,
	state,
}: {
	readonly row: SettingsRow;
	readonly state: SettingsRowState;
}): ReactElement {
	const [enabled, requestEnabled] = useSettingsValue(SettingsRowAccessors.exclusionEnabled(), state);
	return (
		<label className="vicinity-graph-exclusion__toggle-row" title={row.description}>
			<span>{row.label}</span>
			<ToggleSwitch checked={enabled} onChange={requestEnabled} ariaLabel={SettingsRowNames.sole(row)} />
		</label>
	);
}

/**
 * The patterns, READ-ONLY (per CLARIFICATION: the patterns, not the excluded note
 * list). Editing stays in the settings tab, which is what the hint says.
 *
 * Rendered ALWAYS and marked `aria-disabled` while exclusion is off — the panel's
 * expression of the row's declared `disabledWhen`, matching the settings tab's
 * disabled textarea. There is no editable control here to disable, so the state has
 * to be carried by the wrapper plus the hint.
 */
function ExclusionPatternsRow({
	row,
	state,
}: {
	readonly row: SettingsRow;
	readonly state: SettingsRowState;
}): ReactElement {
	const patterns = SettingsRowAccessors.exclusionPatterns().read(state);
	const disabled = isSettingsRowDisabled(row, state);
	return (
		<div className="vicinity-graph-exclusion__patterns-row" aria-disabled={disabled}>
			{patterns.length > 0 ? (
				<ul className="vicinity-graph-exclusion__patterns" aria-label={SettingsRowNames.sole(row)}>
					{/* Index keys: the list is read-only and rebuilt wholesale, and raw user
					    patterns are not guaranteed unique. */}
					{patterns.map((pattern, index) => (
						<li key={index}>
							<code>{pattern}</code>
						</li>
					))}
				</ul>
			) : null}
			<div className="vicinity-graph-exclusion__hint">{exclusionHint(patterns.length, disabled)}</div>
		</div>
	);
}

/** What the read-only patterns row says about itself, in each of its three states. */
function exclusionHint(patternCount: number, disabled: boolean): string {
	if (patternCount === 0) {
		return "No patterns yet — add them in the plugin settings.";
	}
	return disabled
		? "Exclusion is off, so these patterns are inactive. They are edited in the plugin settings."
		: "Patterns are edited in the plugin settings.";
}
