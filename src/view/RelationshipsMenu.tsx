import type { ReactElement } from "react";
import { useSyncExternalStore } from "react";
import { aiNamingStatusLine } from "./aiNamingStatusLine";
import type { ControlsModel } from "./ControlsModel";
import type { SettingsRowState } from "./settingsRows";
import { SETTINGS_GROUPS } from "./settingsRows";
import { SettingsRowBlockView } from "./GraphToolbar";
import type { AiNamingMenuPort } from "./viewPorts";

/** The menu's accessible name for the retry after a stop — the action, then what it acts on. */
const RETRY_LABEL = "Retry AI naming";

/**
 * The graph's top-right Relationships menu (task 4/4
 * `nid_80xc6z8umlpo1x6u4p1v7eb22_e`): auto mode's status line, a Retry after a
 * stop, and the declared Relationships section's blocks — through the SAME
 * `SettingsRowBlockView` the controls panel renders every other section with, so the toggle,
 * key, model and effort behave exactly as they do there and in the settings tab.
 * That section declares `graphSurface: "relationships-menu"`, which is why the
 * top-left controls panel skips it.
 *
 * Collapsed by default, like the controls panel: a native `<details>` whose
 * summary is the section heading. `nowheel`/`nodrag`/`nopan` keep interaction with
 * the menu from panning or zooming the canvas beneath it.
 */
export function RelationshipsMenu({
	controls,
	aiNaming,
}: {
	readonly controls: ControlsModel;
	readonly aiNaming: AiNamingMenuPort;
}): ReactElement {
	const status = useSyncExternalStore(aiNaming.subscribe, aiNaming.status);
	const group = SETTINGS_GROUPS.relationships;
	const state: SettingsRowState = {
		globalDepths: controls.globalDepths,
		globalView: controls.globalView,
		nodeExclusion: controls.nodeExclusion,
		frontmatterLinks: controls.frontmatterLinks,
		relationships: controls.relationships,
	};
	const line = aiNamingStatusLine(status, controls.relationships.autoNaming);
	return (
		<details className="vicinity-graph-relationships-menu nowheel nodrag nopan">
			<summary className="vicinity-graph-relationships-menu__header" title={group.description}>
				{group.heading}
			</summary>
			<div className={`vicinity-graph-relationships-menu__body ${group.panelClass ?? ""}`}>
				<p className="vicinity-graph-relationships-menu__status" role="status" data-kind={line.kind}>
					{line.text}
				</p>
				{line.kind === "stopped" && (
					<button type="button" className="vicinity-graph-relationships-menu__retry" onClick={() => aiNaming.retry()}>
						{RETRY_LABEL}
					</button>
				)}
				{group.blocks.map((block, index) => (
					<SettingsRowBlockView key={index} block={block} state={state} />
				))}
			</div>
		</details>
	);
}
