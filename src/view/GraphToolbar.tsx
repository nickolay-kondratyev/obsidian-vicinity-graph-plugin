import type { ReactElement, ReactNode } from "react";
import type { ControlsModel } from "./ControlsModel";
import { useControlsActions } from "./ControlsActionsContext";
import { Disclosure } from "./Disclosure";
import { SETTINGS_RESET_SCOPES } from "./settingsResetPlan";
import type { SettingsGroup, SettingsRowBlock, SettingsRowState } from "./settingsRows";
import { SETTINGS_GROUPS } from "./settingsRows";
import { SettingsRowView } from "./SettingsRowView";
import type { SettingsSection } from "./settingsSectionFields";
import { SETTINGS_SECTIONS } from "./settingsSectionFields";

/**
 * The in-view controls panel, rendered inside a React-Flow `<Panel position="top-left">`
 * — the SECOND presenter of the declared settings row model (`settingsRows.ts`); the
 * Obsidian settings tab is the first. Section order, headings, which section opens by
 * default, row order and every string come from `SETTINGS_GROUPS`, so the panel cannot
 * quietly lack a row the tab has (or the reverse).
 *
 * Collapsed by default (CLARIFICATION Q1): the whole toolbar is a native `<details>`
 * whose `<summary>` header is always visible. Expanded, EVERY section sits behind its
 * own {@link Disclosure} so the panel stays quiet at a ~300px sidebar width, and the
 * one section declared `openInPanel` is the only one open (settings-ux CLARIFICATION #3).
 *
 * Reads the snapshot's {@link ControlsModel} only, and ONLY to seed what each control
 * displays. It hands its children NO write context: a merge base taken from a rendered
 * snapshot is what used to let one edit revert a sibling field. Children emit an
 * INTERACTION through the `ControlsActionsPort` and `SettingsWritePipeline` plans it
 * against a fresh read (this component and its children hold no business rule).
 *
 * `nowheel`/`nodrag`/`nopan` are React-Flow escape hatches so scrolling and
 * interacting with the panel never pans or zooms the canvas beneath it.
 */
export function GraphToolbar({ controls }: { readonly controls: ControlsModel }): ReactElement {
	// The three global slices, under the names every row descriptor reads them by.
	const state: SettingsRowState = {
		globalDepths: controls.globalDepths,
		globalView: controls.globalView,
		nodeExclusion: controls.nodeExclusion,
	};
	return (
		<details className="vicinity-graph-toolbar nowheel nodrag nopan">
			<summary className="vicinity-graph-toolbar__header">
				<span className="vicinity-graph-toolbar__title">Graph controls</span>
			</summary>
			<div className="vicinity-graph-toolbar__body">
				{SETTINGS_SECTIONS.map((section) => (
					<SettingsSectionView
						key={section}
						section={section}
						group={SETTINGS_GROUPS[section]}
						state={state}
						excludedNodeCount={controls.excludedNodeCount}
					/>
				))}
			</div>
		</details>
	);
}

function SettingsSectionView({
	section,
	group,
	state,
	excludedNodeCount,
}: {
	readonly section: SettingsSection;
	readonly group: SettingsGroup;
	readonly state: SettingsRowState;
	readonly excludedNodeCount: number;
}): ReactElement {
	return (
		<Disclosure
			summary={sectionSummary(section, group, state, excludedNodeCount)}
			summaryTitle={group.description}
			defaultOpen={group.openInPanel}
			className={group.panelClass}
			bodyClassName={group.panelBodyClass}
		>
			{group.blocks.map((block, index) => (
				<SettingsRowBlockView key={index} block={block} state={state} />
			))}
			{group.panelReset === true && <SectionRestoreButton section={section} />}
		</Disclosure>
	);
}

/**
 * A block of rows, wrapped in its declared layout class and — when the block
 * declares one — behind a nested collapsible, exactly as the settings tab renders
 * the same block in a native `<details>`.
 */
function SettingsRowBlockView({
	block,
	state,
}: {
	readonly block: SettingsRowBlock;
	readonly state: SettingsRowState;
}): ReactElement {
	const rows = (
		<>
			{block.rows.map((row) => (
				<SettingsRowView key={row.label} row={row} state={state} />
			))}
		</>
	);
	if (block.collapsedUnder !== undefined) {
		return (
			<Disclosure summary={block.collapsedUnder} className={block.panelClass}>
				{rows}
			</Disclosure>
		);
	}
	// No wrapper when the block declares no layout class: an empty div would add a
	// flex child and change the body's own row spacing.
	return block.panelClass === undefined ? rows : <div className={block.panelClass}>{rows}</div>;
}

/**
 * The panel's restore-defaults button for one section. Runs the SAME plan the
 * settings tab's row runs — the scope name goes to the pipeline, which calls
 * `planSettingsReset`. Building defaults here would make the panel a second opinion
 * on what a default is (guarded by `engineDefaultsSingleSource.test.ts`), and the
 * copy is read from the reset plan so the stated blast radius cannot drift from the
 * key-set written.
 *
 * The accessible name carries the SCOPE, like the settings tab's reset buttons: a
 * bare "Restore defaults" is ambiguous the moment a second one exists.
 *
 * WHY-NOT a confirmation: the panel has no confirm modal, and only the exclusion
 * scope declares one — pinned for every other section scope at once by
 * `settingsResetPlan.test.ts` — so no section that offers this button skips a
 * dialog it was owed.
 */
function SectionRestoreButton({ section }: { readonly section: SettingsSection }): ReactElement {
	const actions = useControlsActions();
	const { label, description } = SETTINGS_RESET_SCOPES[section];
	return (
		<button
			type="button"
			className="vicinity-graph-section-restore"
			aria-label={label}
			title={description}
			onClick={() => void actions.restoreDefaults(section)}
		>
			Restore defaults
		</button>
	);
}

/**
 * A section's disclosure summary. Plain heading text, EXCEPT node exclusion: its
 * excluded-node COUNT is graph telemetry rather than a setting, so it has no row of
 * its own — and it belongs in the summary so it stays visible while the disclosure
 * is collapsed. Shown only when exclusion is enabled AND something was excluded.
 */
function sectionSummary(
	section: SettingsSection,
	group: SettingsGroup,
	state: SettingsRowState,
	excludedNodeCount: number,
): ReactNode {
	if (section !== "node-exclusion") {
		return group.heading;
	}
	const showCount = state.nodeExclusion.enabled && excludedNodeCount > 0;
	return (
		<>
			<span className="vicinity-graph-exclusion__summary-label">{group.heading}</span>
			{showCount && (
				<span
					className="vicinity-graph-exclusion__count"
					title={`${excludedNodeCount} node(s) excluded from this graph`}
				>
					{excludedNodeCount}
				</span>
			)}
		</>
	);
}
