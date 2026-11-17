import type { ReactElement } from "react";
import { GraphModeCopy } from "./graphMode";
import type { GraphModeStatus } from "./graphMode";

/**
 * The graph's bottom-right status pill (tags-v1 decision 12): ALWAYS says which
 * mode the graph on screen is in — "Vicinity of <note>" or "Tagged #tag · N notes"
 * — explains the mode on hover, and in tag mode carries the ONE way out of it.
 *
 * Presentational only: the wording lives in {@link GraphModeCopy}, the mode in the
 * controller's snapshot. The entry points INTO tag mode are elsewhere (plugin
 * `enterTagMode`); this component only ever exits.
 */
export function GraphModePill({
	status,
	onExitTagMode,
}: {
	readonly status: GraphModeStatus;
	readonly onExitTagMode: () => void;
}): ReactElement {
	const { lead, subject, detail } = GraphModeCopy.parts(status);
	return (
		<div className="vicinity-graph-mode-pill" data-graph-mode={status.kind}>
			{/* `status`: a mode switch is announced without stealing focus. The title
			    is the hover explanation — the same affordance the "+N hidden" badge uses. */}
			<span className="vicinity-graph-mode-pill__summary" role="status" title={GraphModeCopy.explanation(status)}>
				<span className="vicinity-graph-mode-pill__lead">{lead}</span>{" "}
				<span className="vicinity-graph-mode-pill__subject">{subject}</span>
				{detail !== null && <span className="vicinity-graph-mode-pill__detail">{` · ${detail}`}</span>}
			</span>
			{status.kind === "tag" && <ExitTagModeButton className="vicinity-graph-mode-pill__exit" onExit={onExitTagMode} />}
		</div>
	);
}

/** The one exit from tag mode — shared by the pill and the no-graph tag states. */
export function ExitTagModeButton({
	className,
	onExit,
}: {
	readonly className: string;
	readonly onExit: () => void;
}): ReactElement {
	return (
		<button type="button" className={className} title={GraphModeCopy.EXIT_TAG_MODE_HINT} onClick={onExit}>
			{GraphModeCopy.EXIT_TAG_MODE}
		</button>
	);
}
