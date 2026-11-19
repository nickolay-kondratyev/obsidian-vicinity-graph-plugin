import type { ReactElement } from "react";
import { hiddenOverlayText, orphanBreakdownTitle } from "./badgeText";
import type { ControlsModel } from "./ControlsModel";
import type { SettingsRowState } from "./settingsRows";
import { GROUPING_MODE_ROW_LABEL } from "./settingsRows";
import { GroupingModeSwitch } from "./SettingsRowView";
import type { OrphanTruncation } from "./truncationBadges";

/**
 * The graph's TOP-RIGHT corner, rendered inside React Flow's
 * `<Panel position="top-right">`: the Folders | Tags grouping toggle, always
 * visible (owner request — not tucked into the collapsed controls panel), and
 * below it the "+N hidden" overlay when the node cap hid notes no box can claim.
 * Stacked in ONE panel so the two can never overlap.
 *
 * The toggle is the panel row's own {@link GroupingModeSwitch} — the same accessor
 * and the same write through the shared `SettingsWritePipeline` — so it is a second
 * PLACE to flip the setting, never a second write path. Its accessible name is the
 * setting's declared label; each segment's tooltip says what it does.
 *
 * `nodrag nopan nowheel`: React Flow escape hatches, so clicking the pill never
 * pans the canvas beneath it.
 */
export function GraphCorner({
	controls,
	orphanTruncation,
}: {
	readonly controls: ControlsModel;
	readonly orphanTruncation: OrphanTruncation;
}): ReactElement {
	const state: SettingsRowState = {
		globalDepths: controls.globalDepths,
		globalView: controls.globalView,
		nodeExclusion: controls.nodeExclusion,
		frontmatterLinks: controls.frontmatterLinks,
	};
	return (
		<div className="vicinity-graph-corner nodrag nopan nowheel">
			<GroupingModeSwitch
				accessibleName={GROUPING_MODE_ROW_LABEL}
				state={state}
				className="vicinity-graph-grouping-toggle"
			/>
			{orphanTruncation.totalHiddenCount > 0 && (
				<div className="vicinity-graph-overlay-badge" title={orphanBreakdownTitle(orphanTruncation.breakdown)}>
					{hiddenOverlayText(orphanTruncation.totalHiddenCount)}
				</div>
			)}
		</div>
	);
}
