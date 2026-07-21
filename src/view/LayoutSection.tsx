import type { LayoutMode, ViewSettings } from "../engine";
import { LAYOUT_MODES } from "../engine";
import type { ReactElement } from "react";
import { useControlsActions } from "./ControlsActionsContext";
import type { SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";

/**
 * The toolbar's layout-mode selector. Writes GLOBAL via the pure
 * {@link planSettingsWrite} `global-layout` command (same single write path as
 * the sizing mirror) — the rebuild then flows the fresh value back, so there is
 * no local form state.
 */

const LAYOUT_MODE_LABELS: Readonly<Record<LayoutMode, string>> = {
	radial: "Radial",
	force: "Organic (force)",
	layered: "Layered (rows)",
};

export function LayoutSection({
	view,
	ctx,
}: {
	readonly view: ViewSettings;
	readonly ctx: SettingsWriteContext;
}): ReactElement {
	const actions = useControlsActions();
	return (
		<label className="vicinity-graph-layout">
			<span>Layout</span>
			<select
				value={view.layoutMode}
				onChange={(event) => {
					const layoutMode = LAYOUT_MODES.find((mode) => mode === event.target.value);
					if (layoutMode !== undefined) {
						void actions.applySettings(planSettingsWrite({ kind: "global-layout", layoutMode }, ctx));
					}
				}}
			>
				{LAYOUT_MODES.map((mode) => (
					<option key={mode} value={mode}>
						{LAYOUT_MODE_LABELS[mode]}
					</option>
				))}
			</select>
		</label>
	);
}
