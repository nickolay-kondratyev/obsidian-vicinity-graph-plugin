import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { LinkOccurrence, OutlineEntry } from "../engine";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import { ContextRowCollapseState } from "./contextRowCollapse";
import type { BacklinkGroupModel, ContextRow, LinkPreviewModel } from "./linkPreviewModel";
import { outlineEntryLabel } from "./outlineEntryLabel";

/**
 * The link-preview modal's React content (parent ticket
 * `nid_tohotgq2s92dvd1iov1rd0umv_e`): sections + expandable context rows over a
 * built {@link LinkPreviewModel}. Collapse/expand state lives HERE (one
 * `ContextRowCollapseState` in a `useState`) — the model is immutable data.
 *
 * Ports come in as two plain function props, not context: the modal is its own
 * React root (never inside `VicinityGraphFlow`), so a provider would be
 * ceremony around a pass-through. Styles live in `link-preview.css`.
 */

/** Where one GO click navigates: the note CONTAINING the occurrence, at its line. */
export interface LinkPreviewGoTarget {
	readonly path: string;
	/** 0-based (`LinkContextSnippet.line` → `OpenNoteOptions.line`). */
	readonly line: number;
}

export interface LinkPreviewContentProps {
	readonly model: LinkPreviewModel;
	/** The `GraphUiPort.renderIcon` seam — built-in (lucide) icon into `el`. */
	readonly renderIcon: (el: HTMLElement, iconId: string) => void;
	/** GO click. The MODAL closes itself and navigates — this component only reports. */
	readonly onGo: (target: LinkPreviewGoTarget) => void;
}

/** Lucide icon of every GO button — one id, so every row's affordance matches. */
export const GO_ICON_ID = "corner-down-right";

export function LinkPreviewContent({ model, renderIcon, onGo }: LinkPreviewContentProps): ReactElement {
	const [collapse, setCollapse] = useState(() => ContextRowCollapseState.allCollapsed(model.rowIds));
	const enablement = collapse.enablement();
	const rowProps: SharedRowProps = {
		collapse,
		onToggle: (rowId) => setCollapse((state) => state.toggled(rowId)),
		renderIcon,
		onGo,
	};
	return (
		<div className="vicinity-graph-link-preview">
			<div className="vicinity-graph-link-preview__toolbar">
				<button
					type="button"
					disabled={!enablement.expandAllEnabled}
					onClick={() => setCollapse((state) => state.expandedAll())}
				>
					Expand all
				</button>
				<button
					type="button"
					disabled={!enablement.collapseAllEnabled}
					onClick={() => setCollapse((state) => state.collapsedAll())}
				>
					Collapse all
				</button>
			</div>
			{model.kind === "node" ? (
				<>
					<Section title="Outline" count={model.outline.length} emptyText="No headings in this note.">
						<OutlineList entries={model.outline} />
					</Section>
					<Section title="Links" count={model.linkRows.length} emptyText="No outgoing links.">
						<RowList rows={model.linkRows} goPath={model.path} shared={rowProps} />
					</Section>
					<Section
						title="Backlinks"
						count={model.backlinkGroups.reduce((sum, group) => sum + group.rows.length, 0)}
						emptyText="No backlinks."
					>
						<BacklinkGroups groups={model.backlinkGroups} shared={rowProps} />
					</Section>
				</>
			) : (
				<Section title="Link occurrences" count={model.rows.length} emptyText="No link occurrences.">
					<RowList rows={model.rows} goPath={model.sourcePath} shared={rowProps} />
				</Section>
			)}
		</div>
	);
}

/** The row callbacks/state every occurrence list shares, bundled once. */
interface SharedRowProps {
	readonly collapse: ContextRowCollapseState;
	readonly onToggle: (rowId: string) => void;
	readonly renderIcon: (el: HTMLElement, iconId: string) => void;
	readonly onGo: (target: LinkPreviewGoTarget) => void;
}

/** One titled section; empty content renders a DESIGNED empty state, never a void. */
function Section({
	title,
	count,
	emptyText,
	children,
}: {
	readonly title: string;
	readonly count: number;
	readonly emptyText: string;
	readonly children: ReactElement;
}): ReactElement {
	return (
		<section className="vicinity-graph-link-preview__section" aria-label={title}>
			<h3 className="vicinity-graph-link-preview__section-title">
				{title}
				<span className="vicinity-graph-link-preview__count">{count}</span>
			</h3>
			{count === 0 ? <p className="vicinity-graph-link-preview__empty">{emptyText}</p> : children}
		</section>
	);
}

/** The clicked note's headings, indented by level — display only (GO is per occurrence). */
function OutlineList({ entries }: { readonly entries: readonly OutlineEntry[] }): ReactElement {
	return (
		<ul className="vicinity-graph-link-preview__outline">
			{entries.map((entry, index) => (
				// Index keys are safe: the list is immutable for the modal's lifetime.
				<li key={index} className={`vicinity-graph-link-preview__outline-entry--level-${entry.level}`}>
					{outlineEntryLabel(entry.rawText)}
				</li>
			))}
		</ul>
	);
}

function RowList({
	rows,
	goPath,
	shared,
}: {
	readonly rows: readonly ContextRow[];
	/** The note the rows' occurrences live in — every row's GO target path. */
	readonly goPath: string;
	readonly shared: SharedRowProps;
}): ReactElement {
	return (
		<ul className="vicinity-graph-link-preview__rows">
			{rows.map((row) => (
				<OccurrenceRow key={row.rowId} row={row} goPath={goPath} shared={shared} />
			))}
		</ul>
	);
}

function BacklinkGroups({
	groups,
	shared,
}: {
	readonly groups: readonly BacklinkGroupModel[];
	readonly shared: SharedRowProps;
}): ReactElement {
	return (
		<div className="vicinity-graph-link-preview__groups">
			{groups.map((group) => (
				<div key={group.sourcePath} className="vicinity-graph-link-preview__group">
					<h4 className="vicinity-graph-link-preview__group-title" title={group.sourcePath}>
						{VaultPathFacts.titleOf(group.sourcePath)}
						<span className="vicinity-graph-link-preview__count">{group.rows.length}</span>
					</h4>
					<RowList rows={group.rows} goPath={group.sourcePath} shared={shared} />
				</div>
			))}
		</div>
	);
}

/**
 * One occurrence. With context: a toggle button (short ↔ expanded snippet,
 * CSS disclosure marker driven by `aria-expanded`) plus a GO icon button.
 * Without context (fallback-path occurrence — no position): a plain muted row,
 * no toggle and NO GO icon — never a dead control.
 */
function OccurrenceRow({
	row,
	goPath,
	shared,
}: {
	readonly row: ContextRow<LinkOccurrence>;
	readonly goPath: string;
	readonly shared: SharedRowProps;
}): ReactElement {
	const context = row.occurrence.context;
	if (context === null) {
		return (
			<li className="vicinity-graph-link-preview__row vicinity-graph-link-preview__row--no-context">
				No context available
			</li>
		);
	}
	const expanded = shared.collapse.isExpanded(row.rowId);
	return (
		<li className="vicinity-graph-link-preview__row">
			<button
				type="button"
				className="vicinity-graph-link-preview__row-toggle"
				aria-expanded={expanded}
				onClick={() => shared.onToggle(row.rowId)}
			>
				{/* Raw markdown text, per the parent ticket's explicit v1 allowance. */}
				<span className="vicinity-graph-link-preview__context">
					{expanded ? context.expandedContext : context.shortContext}
				</span>
			</button>
			<GoButton
				target={{ path: goPath, line: context.line }}
				renderIcon={shared.renderIcon}
				onGo={shared.onGo}
			/>
		</li>
	);
}

function GoButton({
	target,
	renderIcon,
	onGo,
}: {
	readonly target: LinkPreviewGoTarget;
	readonly renderIcon: (el: HTMLElement, iconId: string) => void;
	readonly onGo: (target: LinkPreviewGoTarget) => void;
}): ReactElement {
	const iconRef = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (iconRef.current !== null) {
			renderIcon(iconRef.current, GO_ICON_ID);
		}
	}, [renderIcon]);
	const label = `Go to line ${target.line + 1} in ${VaultPathFacts.titleOf(target.path)}`;
	return (
		<button
			type="button"
			className="vicinity-graph-link-preview__go"
			aria-label={label}
			title={label}
			onClick={() => onGo(target)}
		>
			<span ref={iconRef} className="vicinity-graph-link-preview__go-icon" aria-hidden="true" />
		</button>
	);
}
