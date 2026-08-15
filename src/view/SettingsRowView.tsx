import type { FocusEventHandler, KeyboardEventHandler, ReactElement } from "react";
import { useId, useState } from "react";
import type { DepthSettings, ForceLayoutSettings, NodePreviewPreference } from "../engine";
import { NODE_PREVIEW_PREFERENCES } from "../engine";
import { useControlsActions } from "./ControlsActionsContext";
import { DepthStepper } from "./DepthStepper";
import { NODE_PREVIEW_OPTION_META } from "./nodePreviewPreferenceMeta";
import type { NumberRowJudge } from "./numberRowCommit";
import { NO_CROSS_FIELD_RULE, NumberFieldRefusal, NumberRowCommitPolicy } from "./numberRowCommit";
import type {
	SettingsNumberAccessor,
	SettingsTypedNumberAccessor,
	SettingsValueAccessor,
} from "./settingsRowAccessors";
import { SettingsRowAccessors } from "./settingsRowAccessors";
import type { SettingsRow, SettingsRowState } from "./settingsRows";
import { SettingsRowNames, isSettingsRowDisabled, unhandledRowControl } from "./settingsRows";
import type { SizingNumberField } from "./settingsWritePlan";
import { SizingRowWrite } from "./sizingRowWrite";
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
 * - A control the user TYPES into commits ON BLUR, not per keystroke, so a clamp can
 *   never land mid-word ({@link NumberRow}); a control the user AIMS (slider, stepper,
 *   toggle, pill) commits immediately, because each of its values is already a whole
 *   deliberate one. Stated plainly, because it is the one place the split is not clean:
 *   a number input's native SPINNER arrows are aimed, yet they move the text, so they
 *   too apply only on blur. Accepted — the arrows step by 1 on fields whose useful
 *   moves are tens of pixels, so they are the rare way to use these rows.
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
		case "sizing-number":
			return <SizingNumberRow row={row} field={row.control.field} state={state} />;
		case "node-preview":
			return <NodePreviewRow row={row} state={state} />;
		case "show-cross-links":
			return <ShowCrossLinksRow row={row} state={state} />;
		case "group-label-full-path":
			return <GroupLabelFullPathRow row={row} state={state} />;
		case "edge-depth-into-groups":
			return <EdgeDepthIntoGroupsRow row={row} state={state} />;
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
		case "id-ref-fields":
			return <IdRefFieldsRow row={row} state={state} />;
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
): readonly [T, (value: T) => void] {
	const actions = useControlsActions();
	return useOptimisticValue(accessor.read(state), (value) => actions.applySettings(accessor.interaction(value)));
}

/**
 * The same, for a NUMBER — always handing {@link useOptimisticValue} the accessor's own
 * `settlesAt`.
 *
 * A separate hook rather than an optional argument on {@link useSettingsValue}: that hook
 * is documented as REQUIRING `settlesAt` from any clamping control, a numeric accessor
 * always has one, and a call site that forgot it would leave the control stuck showing a
 * value the store will never echo back. Nothing to forget if there is nothing to pass.
 */
function useSettingsNumber(
	accessor: SettingsNumberAccessor,
	state: SettingsRowState,
): readonly [number, (value: number) => void] {
	const actions = useControlsActions();
	return useOptimisticValue(
		accessor.read(state),
		(value) => actions.applySettings(accessor.interaction(value)),
		accessor.settlesAt,
	);
}

/**
 * A stacked label + value readout above a full-width native range input. The
 * inline readout replaces the settings tab's hover tooltip: a drag needs feedback
 * without a hover.
 *
 * The accessor's bounds always carry a ceiling ({@link SettingsRowBounds} requires
 * `max`): a native range input whose `max` is absent silently defaults to 100.
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
	const range = accessor.bounds;
	const [shown, request] = useSettingsNumber(accessor, state);
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

/** Everything a typed number field needs beyond its own markup. */
interface CommittedNumberField {
	/**
	 * The input's React `key`. RESEEDING an uncontrolled field is a remount, and two
	 * things reseed it: the store moving under the row, and a commit asking for it
	 * (`NumberRowCommit.reseedsFromStore`) — the latter may leave the stored value
	 * exactly where it was, so the key carries a counter as well as the value.
	 *
	 * A REFUSED commit changes neither, so a refusal is never remounted away: the typed
	 * text stands beside the reason it earned. A store move remounts BOTH — the field
	 * back to the stored number and, through {@link NumberFieldRefusal}, the message out
	 * of existence.
	 */
	readonly key: string;
	/** Spread onto the `<input type="number">`; its markup supplies the rest. */
	readonly inputProps: CommittedNumberFieldProps;
	/** What the last commit refused, ready to render beneath the row — `null` if it refused nothing. */
	readonly refusal: ReactElement | null;
}

/** The half of a typed field's attributes that its commit protocol owns. */
interface CommittedNumberFieldProps {
	readonly min: number;
	readonly max: number | undefined;
	readonly step: number;
	readonly defaultValue: number;
	readonly "aria-invalid": boolean;
	readonly "aria-describedby": string | undefined;
	readonly onBlur: FocusEventHandler<HTMLInputElement>;
	readonly onKeyDown: KeyboardEventHandler<HTMLInputElement>;
}

/**
 * ONE typed number field, committed ON BLUR — the panel's counterpart of the settings
 * tab's debounced typed rows, refusing the same values for the same stated reasons
 * ({@link NumberRowCommitPolicy}, ultimately `describeSizingRejection`).
 *
 * The field is UNCONTROLLED, which is what writing per keystroke used to cost: the
 * clamp landed mid-word (typing `500` into Max px snapped the field to `400` after the
 * third key), and a row that refuses an out-of-spec keystroke could not be backspaced
 * to blank on the way to a new number. Typing is now the user's alone; the store
 * answers only once they leave the field.
 *
 * A HOOK and not a component so a typed field with its OWN markup (the removed
 * metric-weight field was one) shares the PROTOCOL without forcing a layout
 * switch into a shared component — layout is exactly what this module owns per
 * row kind. Today {@link NumberRow} is its only consumer.
 *
 * A refusal belongs to a COMMIT, not to the current state of the fields, so it can go
 * stale in ONE direction: repairing the sibling bound in the other row does not clear
 * it, because nothing about THIS row moved. Left that way on purpose — the alternative
 * is a row subscribing to its sibling's every keystroke — and the recovery is the
 * obvious one, committing this field again. In the other direction it is not left
 * stale: THIS row's stored value moving reseeds the box, and
 * {@link NumberFieldRefusal} retires the message with it, so a stored number is never
 * shown under a complaint about a number it replaced.
 *
 * @param stored what the store holds for this field right now (optimistically)
 */
function useNumberFieldCommit(
	accessor: SettingsTypedNumberAccessor,
	/** The row's cross-field rule, or {@link NO_CROSS_FIELD_RULE} when it has none. */
	write: NumberRowJudge,
	stored: number,
	onCommit: (value: number) => void,
): CommittedNumberField {
	const policy = new NumberRowCommitPolicy(accessor, write);
	// No refusal on mount: `stored` cannot BE a refused value. `clampSizingSettings`
	// raises an inverted pair at every door into the store — including the load of a
	// hand-edited `data.json` — so a row only ever earns a refusal by being typed into.
	const [refusal, setRefusal] = useState<NumberFieldRefusal | undefined>(undefined);
	// Counts the commits that put the STORED value back in the box.
	const [reseeds, setReseeds] = useState(0);
	const refusalId = useId();
	// A refusal is about the value the field held when it was judged, and the field is
	// reseeded whenever the store moves — so {@link NumberFieldRefusal} decides whether
	// the message still has anything to say, rather than this component remembering to.
	const shownRefusal = refusal?.messageWhileStoredIs(stored);
	return {
		key: `${stored}:${reseeds}`,
		inputProps: {
			min: accessor.bounds.min,
			max: accessor.bounds.max,
			step: accessor.bounds.step,
			defaultValue: stored,
			"aria-invalid": shownRefusal !== undefined,
			"aria-describedby": shownRefusal === undefined ? undefined : refusalId,
			onBlur: (event) => {
				// `stored` is the field's `defaultValue`, so it is what an untouched
				// field still holds: the policy turns that commit into a no-op write.
				const committed = policy.commit(event.target.value, stored);
				setRefusal(NumberFieldRefusal.fromCommit(committed, stored));
				if (committed.value !== null) {
					onCommit(committed.value);
				}
				if (committed.reseedsFromStore) {
					setReseeds((remounts) => remounts + 1);
				}
			},
			// Enter COMMITS, by blurring into the handler above rather than by repeating it:
			// a number the user has confirmed must not sit unapplied until they happen to
			// click somewhere else.
			onKeyDown: (event) => {
				if (event.key === "Enter") {
					event.currentTarget.blur();
				}
			},
		},
		refusal:
			shownRefusal === undefined ? null : (
				<div id={refusalId} className="vicinity-graph-number-row__refusal" role="alert">
					{shownRefusal}
				</div>
			),
	};
}

/** A label beside a narrow blur-committed number field. */
function NumberRow({
	row,
	accessor,
	write,
	state,
}: {
	readonly row: SettingsRow;
	readonly accessor: SettingsTypedNumberAccessor;
	readonly write: NumberRowJudge;
	readonly state: SettingsRowState;
}): ReactElement {
	const [shown, request] = useSettingsNumber(accessor, state);
	const field = useNumberFieldCommit(accessor, write, shown, request);
	return (
		<div className="vicinity-graph-number-row-block">
			<label className="vicinity-graph-number-row" title={row.description}>
				<span>{row.label}</span>
				<input key={field.key} type="number" aria-label={SettingsRowNames.sole(row)} {...field.inputProps} />
			</label>
			{field.refusal}
		</div>
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
			accessor={accessor}
			value={accessor.read(state)}
			onChange={(value) => actions.applySettings(accessor.interaction(value))}
		/>
	);
}

/**
 * A sizing bound (min/max node px) — the ONE row kind with a cross-field rule, so the
 * one that hands {@link NumberRow} a `SizingRowWrite`. That is the same object the
 * settings tab judges its sizing rows with, over the same FRESH read of the globals
 * (`ControlsActionsPort.storedGlobalView`, taken at commit time): the snapshot this
 * render drew from can be a whole rebuild behind the sibling bound the user just
 * moved, and judging against it would refuse the second half of a legitimate widening.
 */
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
	return (
		<NumberRow
			row={row}
			accessor={SettingsRowAccessors.sizingNumber(field)}
			write={new SizingRowWrite(field, () => actions.storedGlobalView().sizing)}
			state={state}
		/>
	);
}

function NodeCapRow({ row, state }: { readonly row: SettingsRow; readonly state: SettingsRowState }): ReactElement {
	return <NumberRow row={row} accessor={SettingsRowAccessors.nodeCap()} write={NO_CROSS_FIELD_RULE} state={state} />;
}

/**
 * The comma-separated frontmatter id-ref field list — a free-form text field committed
 * ON BLUR (never per keystroke), the same rule the typed number fields follow: an
 * uncontrolled input reseeded from the store (`key`), so a rebuild carrying the stored
 * value back replaces the box while the user's own typing is theirs alone until they
 * leave. There is no clamp and nothing to refuse — the value is stored verbatim — so
 * this needs none of {@link NumberRow}'s refusal machinery.
 */
function IdRefFieldsRow({
	row,
	state,
}: {
	readonly row: SettingsRow;
	readonly state: SettingsRowState;
}): ReactElement {
	const [shown, request] = useSettingsValue<string>(SettingsRowAccessors.idRefFields(), state);
	return (
		<label className="vicinity-graph-number-row" title={row.description}>
			<span>{row.label}</span>
			<input
				key={shown}
				type="text"
				aria-label={SettingsRowNames.sole(row)}
				defaultValue={shown}
				onBlur={(event) => request(event.target.value)}
				// Enter COMMITS by blurring into the handler above, matching the typed number rows.
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.currentTarget.blur();
					}
				}}
			/>
		</label>
	);
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

function EdgeDepthIntoGroupsRow({
	row,
	state,
}: {
	readonly row: SettingsRow;
	readonly state: SettingsRowState;
}): ReactElement {
	return <SliderRow row={row} accessor={SettingsRowAccessors.edgeDepthIntoGroups()} state={state} />;
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

/**
 * ONE label beside ONE switch — the shape EVERY boolean row in the panel takes.
 * Shared so a second toggle cannot arrive with its own spacing or its own idea of
 * where the accessible name comes from.
 */
function ToggleRow({
	row,
	accessor,
	state,
}: {
	readonly row: SettingsRow;
	readonly accessor: SettingsValueAccessor<boolean>;
	readonly state: SettingsRowState;
}): ReactElement {
	const [enabled, request] = useSettingsValue(accessor, state);
	return (
		<label className="vicinity-graph-toggle-row" title={row.description}>
			<span>{row.label}</span>
			<ToggleSwitch checked={enabled} onChange={request} ariaLabel={SettingsRowNames.sole(row)} />
		</label>
	);
}

function ExclusionEnabledRow({
	row,
	state,
}: {
	readonly row: SettingsRow;
	readonly state: SettingsRowState;
}): ReactElement {
	return <ToggleRow row={row} accessor={SettingsRowAccessors.exclusionEnabled()} state={state} />;
}

function ShowCrossLinksRow({
	row,
	state,
}: {
	readonly row: SettingsRow;
	readonly state: SettingsRowState;
}): ReactElement {
	return <ToggleRow row={row} accessor={SettingsRowAccessors.showCrossLinks()} state={state} />;
}

function GroupLabelFullPathRow({
	row,
	state,
}: {
	readonly row: SettingsRow;
	readonly state: SettingsRowState;
}): ReactElement {
	return <ToggleRow row={row} accessor={SettingsRowAccessors.groupLabelFullPath()} state={state} />;
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
