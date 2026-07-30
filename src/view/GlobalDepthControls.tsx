import type { DepthSettings, Direction } from "../engine";
import type { ReactElement } from "react";
import { useControlsActions } from "./ControlsActionsContext";
import { DepthStepper } from "./DepthStepper";

/**
 * The panel's Depth section: the outgoing/incoming {@link DepthStepper}s for the
 * ONE global depth setting, which drives MAIN and every pinned central alike
 * (owner decision 2026-07-29 — there are no per-note or per-central dials).
 *
 * It owns NO business rule and NO merge base: it names the interaction
 * (`global-depth` for one direction) and hands it to the `ControlsActionsPort`,
 * which plans it against the globals as they are at WRITE time — the same seam
 * the settings tab's depth sliders write through.
 */
export function GlobalDepthControls({ depths }: { readonly depths: DepthSettings }): ReactElement {
	const actions = useControlsActions();
	const apply = (direction: Direction, value: number): Promise<void> =>
		actions.applySettings({ kind: "global-depth", direction, value });

	return (
		<div className="vicinity-graph-depth-controls">
			<DepthStepper
				label="Outgoing"
				value={depths.outgoingDepth}
				onChange={(value) => apply("outgoing", value)}
			/>
			<DepthStepper
				label="Incoming"
				value={depths.incomingDepth}
				onChange={(value) => apply("incoming", value)}
			/>
		</div>
	);
}
