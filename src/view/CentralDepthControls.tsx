import type { Direction } from "../engine";
import type { ReactElement } from "react";
import type { CentralControl } from "./ControlsModel";
import { useControlsActions } from "./ControlsActionsContext";
import type { SettingsInteraction, SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";
import { DepthStepper } from "./DepthStepper";

/**
 * One central's depth row (step-06 Phase C): a title plus the outgoing/incoming
 * {@link DepthStepper}s. It owns NO business rule — it only builds a
 * {@link SettingsInteraction} (MAIN's own depth vs. a pinned central's
 * MAIN-view layer) and delegates to the pure {@link planSettingsWrite}, then to
 * the {@link ControlsActionsPort} executor. Steppers disable when the row is not
 * persistable so they never look editable yet silently fail.
 */
export function CentralDepthControls({
	central,
	ctx,
}: {
	readonly central: CentralControl;
	readonly ctx: SettingsWriteContext;
}): ReactElement {
	const actions = useControlsActions();
	// A pinned central always carries a docid (the builder sets it); a null one
	// would have nowhere to write, so treat it as non-editable defensively.
	const editable = central.persistable && (central.kind === "main" || central.docid !== undefined);

	const apply = (direction: Direction, value: number | undefined): void => {
		const interaction: SettingsInteraction =
			central.kind === "main"
				? { kind: "main-depth", direction, value }
				: { kind: "central-depth", centralDocid: central.docid ?? "", direction, value };
		void actions.applySettings(planSettingsWrite(interaction, ctx));
	};

	return (
		<div className="neighborhood-graph-central" data-kind={central.kind}>
			<div className="neighborhood-graph-central__title" title={central.path}>
				{central.title}
			</div>
			<DepthStepper
				label="Outgoing"
				value={central.outgoing.value}
				pinned={central.outgoing.pinned}
				disabled={!editable}
				onChange={(value) => apply("outgoing", value)}
			/>
			<DepthStepper
				label="Incoming"
				value={central.incoming.value}
				pinned={central.incoming.pinned}
				disabled={!editable}
				onChange={(value) => apply("incoming", value)}
			/>
		</div>
	);
}
