import { useRef, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import { useControlsActions } from "./ControlsActionsContext";
import { useEdgeRelationships } from "./EdgeRelationshipContext";
import {
	CLEAR_RELATIONSHIP_ACTION,
	NAME_RELATIONSHIP_ACTION,
	RENAME_RELATIONSHIP_ACTION,
	relationshipRowOf,
} from "./linkPreviewModel";
import type { RelationshipPairModel, RelationshipRowModel } from "./linkPreviewModel";
import { decideRelationshipNameCommit } from "./relationshipNameCommit";
import type { RelationshipNameCommitTrigger } from "./relationshipNameCommit";

/** Accessible name of the drawer's relationship list. */
export const RELATIONSHIPS_LIST_LABEL = "Relationships";

/** Accessible name of the name field — names the DIRECTED pair, since a drawer can list several. */
export function relationshipNameFieldLabel(pair: RelationshipPairModel): string {
	return `Relationship name for ${pair.sourceName} → ${pair.targetName}`;
}

/**
 * The edge drawer's relationship list (tickets `nid_gk9h4jpa7di1al7och0rehd3h_e`,
 * `nid_a5m4kforr9scit68rhqmqh78o_e`): one line per DIRECTED note pair of the
 * clicked edge — `A —name→ B` with its origin, or `A → B` when unnamed — plus the
 * actions the pair's name allows (`relationshipRowOf`).
 *
 * Names are read LIVE from the relationship overlay, not from the drawer's model:
 * a save rebuilds every view and the rebuild republishes the names, so the line
 * updates in place without reopening the drawer.
 */
export function RelationshipList({ pairs }: { readonly pairs: readonly RelationshipPairModel[] }): ReactElement {
	const relationships = useEdgeRelationships();
	return (
		<ul className="vicinity-graph-link-preview-drawer__relationships" aria-label={RELATIONSHIPS_LIST_LABEL}>
			{pairs.map((pair) => (
				<RelationshipRow key={pair.key} pair={pair} row={relationshipRowOf(pair, relationships.get(pair.key) ?? null)} />
			))}
		</ul>
	);
}

function RelationshipRow({
	pair,
	row,
}: {
	readonly pair: RelationshipPairModel;
	readonly row: RelationshipRowModel;
}): ReactElement {
	const actions = useControlsActions();
	const [editing, setEditing] = useState(false);
	return (
		<li className="vicinity-graph-link-preview-drawer__relationship">
			<span className="vicinity-graph-link-preview-drawer__relationship-pair">{row.text}</span>
			{row.originLabel !== null && (
				<span className="vicinity-graph-link-preview-drawer__relationship-origin">{row.originLabel}</span>
			)}
			{editing ? (
				<RelationshipNameField
					pair={pair}
					currentName={row.currentName}
					onDone={() => setEditing(false)}
				/>
			) : (
				<span className="vicinity-graph-link-preview-drawer__relationship-actions">
					{row.edit !== null && (
						<button type="button" onClick={() => setEditing(true)}>
							{row.edit === "name" ? NAME_RELATIONSHIP_ACTION : RENAME_RELATIONSHIP_ACTION}
						</button>
					)}
					{row.clearable && (
						<button type="button" onClick={() => void actions.clearRelationship(pair.sourcePath, pair.targetPath)}>
							{CLEAR_RELATIONSHIP_ACTION}
						</button>
					)}
				</span>
			)}
		</li>
	);
}

/**
 * The name field: uncontrolled and committed on Enter / blur, never per keystroke
 * (`decideRelationshipNameCommit` judges each commit). Escape cancels the edit
 * WITHOUT closing the drawer. A refusal keeps the field open with the user's text.
 */
function RelationshipNameField({
	pair,
	currentName,
	onDone,
}: {
	readonly pair: RelationshipPairModel;
	readonly currentName: string | null;
	readonly onDone: () => void;
}): ReactElement {
	const actions = useControlsActions();
	const [refusal, setRefusal] = useState<string | null>(null);
	// Enter / Escape close the field, and an unmounting input may still report a
	// blur — the first ending wins, so one edit never writes twice.
	const ended = useRef(false);

	const commit = (typed: string, trigger: RelationshipNameCommitTrigger): void => {
		if (ended.current) {
			return;
		}
		const decision = decideRelationshipNameCommit(typed, currentName, trigger);
		if (decision.kind === "refuse") {
			setRefusal(decision.message);
			return;
		}
		ended.current = true;
		if (decision.kind === "save") {
			void actions.nameRelationship(pair.sourcePath, pair.targetPath, decision.name);
		}
		onDone();
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
		if (event.key === "Enter") {
			event.preventDefault();
			commit(event.currentTarget.value, "enter");
		} else if (event.key === "Escape") {
			// The drawer closes on a window-level Escape; this one only ends the edit.
			event.stopPropagation();
			ended.current = true;
			onDone();
		}
	};

	return (
		<span className="vicinity-graph-link-preview-drawer__relationship-edit">
			<input
				type="text"
				className="vicinity-graph-link-preview-drawer__relationship-input"
				aria-label={relationshipNameFieldLabel(pair)}
				aria-invalid={refusal !== null}
				defaultValue={currentName ?? ""}
				// The user just asked to type a name; focusing the field is the point of the click.
				autoFocus
				onKeyDown={onKeyDown}
				onBlur={(event) => commit(event.currentTarget.value, "blur")}
			/>
			{refusal !== null && (
				<span role="alert" className="vicinity-graph-link-preview-drawer__relationship-refusal">
					{refusal}
				</span>
			)}
		</span>
	);
}
