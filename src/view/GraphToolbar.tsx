import type { ReactElement } from "react";
import { CentralDepthControls } from "./CentralDepthControls";
import type { ControlsModel } from "./ControlsModel";
import type { SettingsWriteContext } from "./settingsWritePlan";
import { SizingSection } from "./SizingSection";

/**
 * The in-view controls panel (step-06 Phase C), rendered inside a React-Flow
 * `<Panel position="top-left">`. Collapsed by default (CLARIFICATION Q1): the
 * whole toolbar is a native `<details>` whose `<summary>` header is always
 * visible. Expanded, MAIN's depth steppers are front-and-centre; the pinned
 * centrals and the sizing controls each sit behind their own disclosure so the
 * panel stays quiet at a ~300px sidebar width. Reads the snapshot's
 * {@link ControlsModel} only — every write is delegated by its children through
 * `planSettingsWrite` + the `ControlsActionsPort` (this component holds no
 * business rule).
 *
 * `nowheel`/`nodrag`/`nopan` are React-Flow escape hatches so scrolling and
 * interacting with the panel never pans or zooms the canvas beneath it.
 */
export function GraphToolbar({ controls }: { readonly controls: ControlsModel }): ReactElement | null {
	const main = controls.centrals[0];
	if (main === undefined) {
		return null; // Empty view — no central to control.
	}
	const ctx: SettingsWriteContext = { globalDepths: controls.globalDepths, globalView: controls.globalView };
	const pinned = controls.centrals.filter((central) => central.kind === "pinned");

	return (
		<details className="vicinity-graph-toolbar nowheel nodrag nopan">
			<summary className="vicinity-graph-toolbar__header">
				<span className="vicinity-graph-toolbar__title">Graph controls</span>
			</summary>
			<div className="vicinity-graph-toolbar__body">
				<CentralDepthControls central={main} ctx={ctx} />
				{pinned.length > 0 && (
					<details className="vicinity-graph-disclosure">
						<summary className="vicinity-graph-disclosure__summary">
							Pinned centrals ({pinned.length})
						</summary>
						<div className="vicinity-graph-disclosure__body">
							{pinned.map((central) => (
								<CentralDepthControls key={central.path} central={central} ctx={ctx} />
							))}
						</div>
					</details>
				)}
				<SizingSection view={controls.globalView} ctx={ctx} />
			</div>
		</details>
	);
}
