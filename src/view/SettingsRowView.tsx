import type { ReactElement } from "react";
import { useId } from "react";
import type {
	Channel,
	ForceLayoutSettings,
	NodePreviewPreference,
	SettingsRange,
	SizeMetricId,
	SizingMetricSetting,
} from "../engine";
import {
	CHANNEL_DEPTH_FIELD,
	FORCE_LAYOUT_RANGES,
	MAX_OUTLINE_DEPTH,
	MIN_NODE_CAP,
	MIN_OUTLINE_DEPTH,
	NODE_PREVIEW_PREFERENCES,
	SETTINGS_SPEC,
	SIZING_RANGES,
	clampOutlineMaxDepth,
	clampSizingNumber,
} from "../engine";
import { useControlsActions } from "./ControlsActionsContext";
import { DepthStepper } from "./DepthStepper";
import { NODE_PREVIEW_OPTION_META } from "./nodePreviewPreferenceMeta";
import type { SettingsRow, SettingsRowState } from "./settingsRows";
import { SettingsRowNames, isSettingsRowDisabled, unhandledRowControl } from "./settingsRows";
import type { SizingNumberField } from "./settingsWritePlan";
import { parseSizingInput } from "./sizingInput";
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
 */

/** Outline-depth slider granularity — from the spec, like its bounds. */
const OUTLINE_DEPTH_SLIDER_STEP = SETTINGS_SPEC.globalView.outlineMaxDepth.step;

/** The node cap is a whole number of nodes. */
const NODE_CAP_STEP = 1;

export function SettingsRowView({
	row,
	state,
}: {
	readonly row: SettingsRow;
	readonly state: SettingsRowState;
}): ReactElement {
	switch (row.control.kind) {
		case "depth":
			return <DepthRow row={row} channel={row.control.channel} state={state} />;
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
 * A stacked label + value readout above a full-width native range input. The
 * inline readout replaces the settings tab's hover tooltip: a drag needs feedback
 * without a hover.
 */
function SliderRow({
	row,
	range,
	value,
	commit,
	settlesAt,
}: {
	readonly row: SettingsRow;
	readonly range: SettingsRange;
	readonly value: number;
	readonly commit: (value: number) => Promise<void>;
	readonly settlesAt?: (value: number) => number;
}): ReactElement {
	const [shown, request] = useOptimisticValue(value, commit, settlesAt);
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
 * A label beside a narrow number field. `accept` decides what counts as a typed
 * value — the `min` attribute alone only drives the steppers, never a typed one.
 */
function NumberRow({
	row,
	value,
	min,
	max,
	step,
	commit,
	settlesAt,
	accept,
}: {
	readonly row: SettingsRow;
	readonly value: number;
	readonly min: number;
	readonly max?: number;
	readonly step: number;
	readonly commit: (value: number) => Promise<void>;
	readonly settlesAt?: (value: number) => number;
	/** `undefined` ⇒ the field is mid-edit and nothing may be written yet. */
	readonly accept: (raw: string) => number | undefined;
}): ReactElement {
	const [shown, request] = useOptimisticValue(value, commit, settlesAt);
	return (
		<label className="vicinity-graph-number-row" title={row.description}>
			<span>{row.label}</span>
			<input
				type="number"
				aria-label={SettingsRowNames.sole(row)}
				min={min}
				max={max}
				step={step}
				value={shown}
				onChange={(event) => {
					const parsed = accept(event.target.value);
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
	channel,
	state,
}: {
	readonly row: SettingsRow;
	readonly channel: Channel;
	readonly state: SettingsRowState;
}): ReactElement {
	const actions = useControlsActions();
	return (
		<DepthStepper
			row={row}
			value={state.globalDepths[CHANNEL_DEPTH_FIELD[channel]]}
			onChange={(value) => actions.applySettings({ kind: "global-depth", channel, value })}
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
	const actions = useControlsActions();
	const setting: SizingMetricSetting = state.globalView.sizing.metrics[metric];
	const [enabled, requestEnabled] = useOptimisticValue(setting.enabled, (value) =>
		actions.applySettings({ kind: "global-sizing-metric-enabled", metric, enabled: value }),
	);
	const [weight, requestWeight] = useOptimisticValue(
		setting.weight,
		(value) => actions.applySettings({ kind: "global-sizing-metric-weight", metric, weight: value }),
		(value) => clampSizingNumber("metricWeight", value),
	);
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
				min={SIZING_RANGES.metricWeight.min}
				max={SIZING_RANGES.metricWeight.max}
				step={SIZING_RANGES.metricWeight.step}
				value={weight}
				disabled={!enabled}
				onChange={(event) => {
					const parsed = parseSizingInput(event.target.value);
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
	const actions = useControlsActions();
	const range = SIZING_RANGES[field];
	return (
		<NumberRow
			row={row}
			value={state.globalView.sizing[field]}
			min={range.min}
			max={range.max}
			step={range.step}
			commit={(value) => actions.applySettings({ kind: "global-sizing-number", field, value })}
			settlesAt={(value) => clampSizingNumber(field, value)}
			accept={parseSizingInput}
		/>
	);
}

function NodeCapRow({ row, state }: { readonly row: SettingsRow; readonly state: SettingsRowState }): ReactElement {
	const actions = useControlsActions();
	return (
		<NumberRow
			row={row}
			value={state.globalView.nodeCap}
			min={MIN_NODE_CAP}
			step={NODE_CAP_STEP}
			commit={(value) => actions.applySettings({ kind: "global-cap", value })}
			// Deliberately NOT `parseSizingInput`: a cap is a whole number of nodes, and
			// the write path does not clamp it — so a half-typed or out-of-range entry
			// must not be written at all (same rule the settings tab's row applies).
			//
			// KNOWN LIMIT of applying that rule to a CONTROLLED input: a rejected
			// keystroke leaves the field showing the stored value, so the box cannot be
			// emptied on the way to a new number (select-and-retype works; backspacing to
			// blank does not). The settings tab's uncontrolled input keeps the text and
			// only drops the write. Refusing an out-of-spec write is the property worth
			// keeping; the panel's numeric-entry feedback is the open ticket
			// `nid_hatwq2jlkhno5t6awcz0q6t9q_e`, which this row now shares.
			accept={(raw) => {
				const value = Number(raw);
				return Number.isInteger(value) && value >= MIN_NODE_CAP ? value : undefined;
			}}
		/>
	);
}

function OutlineDepthRow({
	row,
	state,
}: {
	readonly row: SettingsRow;
	readonly state: SettingsRowState;
}): ReactElement {
	const actions = useControlsActions();
	return (
		<SliderRow
			row={row}
			range={{ min: MIN_OUTLINE_DEPTH, max: MAX_OUTLINE_DEPTH, step: OUTLINE_DEPTH_SLIDER_STEP }}
			value={state.globalView.outlineMaxDepth}
			commit={(value) => actions.applySettings({ kind: "global-outline-depth", value })}
			settlesAt={clampOutlineMaxDepth}
		/>
	);
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
	const actions = useControlsActions();
	return (
		<SliderRow
			row={row}
			range={FORCE_LAYOUT_RANGES[field]}
			value={state.globalView.forceLayout[field]}
			commit={(value) => actions.applySettings({ kind: "global-force-layout-field", field, value })}
		/>
	);
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
	const actions = useControlsActions();
	/*
	 * Radio grouping is DOCUMENT-scoped for inputs outside a `<form>`. The settings
	 * tab's pill uses its own constant name; this one must be unique per mount, or
	 * two open surfaces (or two graph views) would fuse into one group and un-check
	 * each other. `useId()` is exactly that guarantee — which is why the shared row
	 * model does NOT own the name.
	 */
	const groupName = useId();
	const [selected, request] = useOptimisticValue<NodePreviewPreference>(
		state.globalView.nodePreviewPreference,
		(value) => actions.applySettings({ kind: "global-node-preview", value }),
	);
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
	const actions = useControlsActions();
	const [enabled, requestEnabled] = useOptimisticValue(state.nodeExclusion.enabled, (value) =>
		actions.applySettings({ kind: "global-exclusion-enabled", enabled: value }),
	);
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
	const { patterns } = state.nodeExclusion;
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
