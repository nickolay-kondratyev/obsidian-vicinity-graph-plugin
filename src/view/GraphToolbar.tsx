import type { ReactElement } from "react";
import type { ControlsModel } from "./ControlsModel";
import { Disclosure } from "./Disclosure";
import { GlobalDepthControls } from "./GlobalDepthControls";
import { ForceLayoutSection } from "./ForceLayoutSection";
import { NodeContentsSection } from "./NodeContentsSection";
import { NodeExclusionSection } from "./NodeExclusionSection";
import { SizingSection } from "./SizingSection";

/**
 * The in-view controls panel (step-06 Phase C), rendered inside a React-Flow
 * `<Panel position="top-left">`. Collapsed by default (CLARIFICATION Q1): the
 * whole toolbar is a native `<details>` whose `<summary>` header is always
 * visible. Expanded, EVERY section sits behind its own {@link Disclosure} so
 * the panel stays quiet at a ~300px sidebar width — Depth (the most-used
 * control) is the ONLY one open by default (settings-ux CLARIFICATION #3).
 * Reads the snapshot's {@link ControlsModel} only, and ONLY to seed what each
 * control displays. It deliberately hands its children NO write context: a merge
 * base taken from a rendered snapshot is what used to let one edit revert a
 * sibling field. Children emit an INTERACTION through the `ControlsActionsPort`
 * and `SettingsWritePipeline` plans it against a fresh read (this component and
 * its children hold no business rule).
 *
 * `nowheel`/`nodrag`/`nopan` are React-Flow escape hatches so scrolling and
 * interacting with the panel never pans or zooms the canvas beneath it.
 */
export function GraphToolbar({ controls }: { readonly controls: ControlsModel }): ReactElement {
	return (
		<details className="vicinity-graph-toolbar nowheel nodrag nopan">
			<summary className="vicinity-graph-toolbar__header">
				<span className="vicinity-graph-toolbar__title">Graph controls</span>
			</summary>
			<div className="vicinity-graph-toolbar__body">
				{/*
				 * "(all notes)" is load-bearing copy, not decoration (owner decision
				 * 2026-07-29): these steppers write the ONE global depth setting, so a
				 * bump here changes every note's graph and every open view. Plain
				 * "Depth" on an in-view panel reads as "this graph's depth" (POLS).
				 * The settings tab's depth card carries the same words.
				 */}
				<Disclosure summary="Depth (all notes)" defaultOpen>
					<GlobalDepthControls depths={controls.globalDepths} />
				</Disclosure>
				<NodeExclusionSection
					nodeExclusion={controls.nodeExclusion}
					excludedNodeCount={controls.excludedNodeCount}
				/>
				<SizingSection view={controls.globalView} />
				{/* Node CONTENTS follow node SIZE, mirroring the settings tab's card order. */}
				<NodeContentsSection view={controls.globalView} />
				<ForceLayoutSection view={controls.globalView} />
			</div>
		</details>
	);
}
