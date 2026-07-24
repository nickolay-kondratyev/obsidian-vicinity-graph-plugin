import type { ReactElement } from "react";
import { useControlsActions } from "./ControlsActionsContext";
import { Disclosure } from "./Disclosure";
import type { SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";
import { ToggleSwitch } from "./ToggleSwitch";

/**
 * The toolbar's node-exclusion disclosure. The {@link ToggleSwitch} flips the
 * GLOBAL exclusion `enabled` flag (preserving the pattern list) through the
 * same pure {@link planSettingsWrite} path as every other control — the rebuild
 * flows the fresh value back, so there is no local state.
 *
 * WHEN ON the body also shows the configured patterns READ-ONLY (per
 * CLARIFICATION: the patterns, not the excluded note list). Editing stays in
 * the settings tab. WHEN OFF the off-position switch alone says so.
 *
 * The excluded COUNT badge lives in the summary so it stays visible while the
 * disclosure is collapsed (no regression vs the old always-visible pill);
 * shown only when exclusion is enabled AND at least one node was excluded.
 */
export function NodeExclusionSection({
	ctx,
	excludedNodeCount,
}: {
	readonly ctx: SettingsWriteContext;
	readonly excludedNodeCount: number;
}): ReactElement {
	const actions = useControlsActions();
	const { enabled, patterns } = ctx.nodeExclusion;
	const showCount = enabled && excludedNodeCount > 0;
	const setEnabled = (nextEnabled: boolean): void => {
		void actions.applySettings(
			planSettingsWrite(
				{ kind: "global-node-exclusion", nodeExclusion: { ...ctx.nodeExclusion, enabled: nextEnabled } },
				ctx,
			),
		);
	};

	return (
		<Disclosure
			className="vicinity-graph-exclusion"
			summary={
				<>
					<span className="vicinity-graph-exclusion__summary-label">Node exclusion</span>
					{showCount && (
						<span
							className="vicinity-graph-exclusion__count"
							title={`${excludedNodeCount} node(s) excluded from this graph`}
						>
							{excludedNodeCount}
						</span>
					)}
				</>
			}
		>
			<label className="vicinity-graph-exclusion__toggle-row">
				<span>Exclude notes</span>
				<ToggleSwitch checked={enabled} onChange={setEnabled} ariaLabel="Exclude notes" />
			</label>
			{enabled &&
				(patterns.length > 0 ? (
					<>
						<ul className="vicinity-graph-exclusion__patterns" aria-label="Exclusion patterns">
							{/* Index keys: the list is read-only and rebuilt wholesale, and raw user
							    patterns are not guaranteed unique. */}
							{patterns.map((pattern, index) => (
								<li key={index}>
									<code>{pattern}</code>
								</li>
							))}
						</ul>
						<div className="vicinity-graph-exclusion__hint">Patterns are edited in the plugin settings.</div>
					</>
				) : (
					<div className="vicinity-graph-exclusion__hint">No patterns yet — add them in the plugin settings.</div>
				))}
		</Disclosure>
	);
}
