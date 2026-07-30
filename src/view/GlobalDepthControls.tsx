import type { DepthSettings, Direction } from "../engine";
import type { ReactElement } from "react";
import { useControlsActions } from "./ControlsActionsContext";
import type { SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";
import { DepthStepper } from "./DepthStepper";

/**
 * The panel's Depth section: the outgoing/incoming {@link DepthStepper}s for the
 * ONE global depth setting, which drives MAIN and every pinned central alike
 * (owner decision 2026-07-29 — there are no per-note or per-central dials).
 *
 * It owns NO business rule: it builds a `global-depth`
 * {@link import("./settingsWritePlan").SettingsInteraction} and delegates to the
 * pure {@link planSettingsWrite}, then to the `ControlsActionsPort` executor —
 * the same seam the settings tab's depth sliders write through.
 */
export function GlobalDepthControls({
	depths,
	ctx,
}: {
	readonly depths: DepthSettings;
	readonly ctx: SettingsWriteContext;
}): ReactElement {
	const actions = useControlsActions();
	const apply = (direction: Direction, value: number): void => {
		void actions.applySettings(planSettingsWrite({ kind: "global-depth", direction, value }, ctx));
	};

	return (
		<div className="vicinity-graph-depth-controls">
			<DepthStepper label="Outgoing" value={depths.outgoingDepth} onChange={(value) => apply("outgoing", value)} />
			<DepthStepper label="Incoming" value={depths.incomingDepth} onChange={(value) => apply("incoming", value)} />
		</div>
	);
}
