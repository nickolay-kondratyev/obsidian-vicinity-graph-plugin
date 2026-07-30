import type { ReactElement } from "react";
import type { NodeExclusionSettings } from "../engine";
import { useControlsActions } from "./ControlsActionsContext";
import { Disclosure } from "./Disclosure";
import { useOptimisticValue } from "./useOptimisticValue";
import { ToggleSwitch } from "./ToggleSwitch";

/**
 * The toolbar's node-exclusion disclosure. The {@link ToggleSwitch} flips the
 * GLOBAL exclusion `enabled` flag through the same one write path as every other
 * control: it emits `global-exclusion-enabled` and the pipeline merges it over the
 * CURRENT stored exclusion, so the pattern list is preserved even when the
 * settings tab is editing it at the same time. The switch itself is optimistic
 * (see {@link useOptimisticValue}) so it flips on the click, not a rebuild later.
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
	nodeExclusion,
	excludedNodeCount,
}: {
	readonly nodeExclusion: NodeExclusionSettings;
	readonly excludedNodeCount: number;
}): ReactElement {
	const actions = useControlsActions();
	const { patterns } = nodeExclusion;
	const [enabled, requestEnabled] = useOptimisticValue(nodeExclusion.enabled, (value) =>
		actions.applySettings({ kind: "global-exclusion-enabled", enabled: value }),
	);
	const showCount = enabled && excludedNodeCount > 0;

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
				<ToggleSwitch checked={enabled} onChange={requestEnabled} ariaLabel="Exclude notes" />
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
