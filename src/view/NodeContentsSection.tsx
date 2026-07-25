import type { ReactElement } from "react";
import { useId } from "react";
import type { NodePreviewPreference, ViewSettings } from "../engine";
import { NODE_PREVIEW_PREFERENCES } from "../engine";
import { useControlsActions } from "./ControlsActionsContext";
import { Disclosure } from "./Disclosure";
import { NODE_PREVIEW_OPTION_META, NODE_PREVIEW_ROW_LABEL } from "./nodePreviewPreferenceMeta";
import type { SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";

/**
 * The in-view mirror of the settings tab's "Node contents" card: the Preview
 * pill, writing the SAME global through the SAME `global-node-preview`
 * interaction the tab emits (no per-doc override — CLARIFICATION Q3). Copy comes
 * from the shared {@link NODE_PREVIEW_OPTION_META} and the order from
 * {@link NODE_PREVIEW_PREFERENCES}, so the two pills cannot drift; only the
 * markup is duplicated, because Obsidian's `Setting` API cannot mount in React.
 *
 * Fully controlled off `view.nodePreviewPreference` — no local state to go stale
 * when the tab (or a reset) writes the same field, exactly like
 * `SizingSection`/`ForceLayoutSection`.
 *
 * The outline-depth slider is deliberately NOT mirrored here; that pre-existing
 * parity gap is tracked separately.
 */
export function NodeContentsSection({
	view,
	ctx,
}: {
	readonly view: ViewSettings;
	readonly ctx: SettingsWriteContext;
}): ReactElement {
	const actions = useControlsActions();
	/*
	 * Radio grouping is DOCUMENT-scoped for inputs outside a `<form>`. The
	 * settings modal's pill uses its own constant name; this one must be unique
	 * per mount, or two open surfaces (or two graph views) would fuse into one
	 * group and un-check each other. `useId()` is exactly that guarantee.
	 */
	const groupName = useId();
	const apply = (value: NodePreviewPreference): void => {
		void actions.applySettings(planSettingsWrite({ kind: "global-node-preview", value }, ctx));
	};

	return (
		<Disclosure summary="Node contents" className="vicinity-graph-nodecontents">
			<div className="vicinity-graph-nodecontents__field">
				{/* A plain span, not a <label>: it names the GROUP (carried by the
				    radiogroup's aria-label), not any single radio. A bare
				    Auto/Outline/Image trio would not say what it switches. */}
				<span className="vicinity-graph-nodecontents__label">{NODE_PREVIEW_ROW_LABEL}</span>
				<div className="vicinity-graph-segmented" role="radiogroup" aria-label={NODE_PREVIEW_ROW_LABEL}>
					{NODE_PREVIEW_PREFERENCES.map((preference) => {
						const meta = NODE_PREVIEW_OPTION_META[preference];
						return (
							// The <label> WRAPS its radio, so the visible text is the
							// radio's accessible name with no id/for pairing. The panel
							// has no room for the tab's description text, so it rides as
							// a native title tooltip (same copy, zero drift).
							<label
								key={preference}
								className="vicinity-graph-segmented__option"
								title={meta.description}
							>
								<input
									type="radio"
									name={groupName}
									value={preference}
									checked={view.nodePreviewPreference === preference}
									onChange={() => apply(preference)}
								/>
								<span className="vicinity-graph-segmented__text">{meta.label}</span>
							</label>
						);
					})}
				</div>
			</div>
		</Disclosure>
	);
}
