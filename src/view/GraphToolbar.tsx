import type { ReactElement } from "react";
import type { ControlsModel } from "./ControlsModel";
import { Disclosure } from "./Disclosure";
import { GlobalDepthControls } from "./GlobalDepthControls";
import { ForceLayoutSection } from "./ForceLayoutSection";
import { NodeContentsSection } from "./NodeContentsSection";
import { NodeExclusionSection } from "./NodeExclusionSection";
import type { SettingsWriteContext } from "./settingsWritePlan";
import { SizingSection } from "./SizingSection";

/**
 * The in-view controls panel (step-06 Phase C), rendered inside a React-Flow
 * `<Panel position="top-left">`. Collapsed by default (CLARIFICATION Q1): the
 * whole toolbar is a native `<details>` whose `<summary>` header is always
 * visible. Expanded, EVERY section sits behind its own {@link Disclosure} so
 * the panel stays quiet at a ~300px sidebar width — Depth (the most-used
 * control) is the ONLY one open by default (settings-ux CLARIFICATION #3).
 * Reads the snapshot's {@link ControlsModel} only — every write is delegated
 * by its children through `planSettingsWrite` + the `ControlsActionsPort`
 * (this component holds no business rule).
 *
 * `nowheel`/`nodrag`/`nopan` are React-Flow escape hatches so scrolling and
 * interacting with the panel never pans or zooms the canvas beneath it.
 */
export function GraphToolbar({ controls }: { readonly controls: ControlsModel }): ReactElement {
	const ctx: SettingsWriteContext = {
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
				<Disclosure summary="Depth" defaultOpen>
					<GlobalDepthControls depths={controls.globalDepths} ctx={ctx} />
				</Disclosure>
				<NodeExclusionSection ctx={ctx} excludedNodeCount={controls.excludedNodeCount} />
				<SizingSection view={controls.globalView} ctx={ctx} />
				{/* Node CONTENTS follow node SIZE, mirroring the settings tab's card order. */}
				<NodeContentsSection view={controls.globalView} ctx={ctx} />
				<ForceLayoutSection view={controls.globalView} ctx={ctx} />
			</div>
		</details>
	);
}
