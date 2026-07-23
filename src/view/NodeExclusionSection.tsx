import type { ReactElement } from "react";
import { useControlsActions } from "./ControlsActionsContext";
import type { SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";

/**
 * The toolbar's node-exclusion pill. Toggles the GLOBAL exclusion `enabled` flag
 * (preserving the pattern list from `ctx.nodeExclusion`) through the same pure
 * {@link planSettingsWrite} path the sizing/layout mirrors use — the rebuild flows
 * the fresh value back, so there is no local state. The pattern LIST is edited in
 * the settings tab (this pill is the quick on/off, per CLARIFICATION).
 *
 * The excluded COUNT is shown next to the label only when exclusion is enabled AND
 * at least one node was excluded for this graph (binding: "enabled AND count > 0").
 */
export function NodeExclusionSection({
	ctx,
	excludedNodeCount,
}: {
	readonly ctx: SettingsWriteContext;
	readonly excludedNodeCount: number;
}): ReactElement {
	const actions = useControlsActions();
	const { enabled } = ctx.nodeExclusion;
	const showCount = enabled && excludedNodeCount > 0;
	return (
		<label className="vicinity-graph-exclusion">
			<input
				type="checkbox"
				checked={enabled}
				onChange={(event) => {
					void actions.applySettings(
						planSettingsWrite(
							{ kind: "global-node-exclusion", nodeExclusion: { ...ctx.nodeExclusion, enabled: event.target.checked } },
							ctx,
						),
					);
				}}
			/>
			<span className="vicinity-graph-exclusion__label">Exclude notes</span>
			{showCount && (
				<span
					className="vicinity-graph-exclusion__count"
					title={`${excludedNodeCount} node(s) excluded from this graph`}
				>
					{excludedNodeCount}
				</span>
			)}
		</label>
	);
}
