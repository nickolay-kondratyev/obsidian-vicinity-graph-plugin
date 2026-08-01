import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { LinkOccurrence, OutlineEntry } from "../engine";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import { ContextRowCollapseState } from "./contextRowCollapse";
import type { BacklinkGroupModel, ContextRow, EdgePairGroupModel, LinkPreviewModel } from "./linkPreviewModel";
import { outlineEntryLabel } from "./outlineEntryLabel";

/**
 * The link preview's React content (parent ticket
 * `nid_tohotgq2s92dvd1iov1rd0umv_e`), hosted by `LinkPreviewDrawer`: sections +
 * expandable context rows over a built {@link LinkPreviewModel}. Collapse/expand
 * state lives HERE (one `ContextRowCollapseState` in a `useState`) — the model
 * is immutable data.
 *
 * Ports come in as two plain function props, not context — the drawer forwards
 * them, and a provider would be ceremony around a pass-through. Styles live in
 * `link-preview.css`.
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
	/** The `GraphUiPort.renderMarkdown` seam — Obsidian-rendered snippet into `el`. */
	readonly renderMarkdown: (el: HTMLElement, markdown: string, sourcePath: string) => Promise<void>;
	/** Click on a rendered `a.internal-link` anchor — a linktext, resolved against the snippet's note. */
	readonly onOpenLink: (linktext: string, sourcePath: string) => void;
	/** GO click. The DRAWER closes itself and navigates — this component only reports. */
	readonly onGo: (target: LinkPreviewGoTarget) => void;
}

/** Lucide icon of every GO button — one id, so every row's affordance matches. */
export const GO_ICON_ID = "corner-down-right";

export function LinkPreviewContent({
	model,
	renderIcon,
	renderMarkdown,
	onOpenLink,
	onGo,
}: LinkPreviewContentProps): ReactElement {
	const [collapse, setCollapse] = useState(() => ContextRowCollapseState.allCollapsed(model.rowIds));
	const enablement = collapse.enablement();
	const rowProps: SharedRowProps = {
		collapse,
		onToggle: (rowId) => setCollapse((state) => state.toggled(rowId)),
		renderIcon,
		renderMarkdown,
		onOpenLink,
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
				<Section
					title="Link occurrences"
					count={model.pairs.reduce((sum, pair) => sum + pair.rows.length, 0)}
					emptyText="No link occurrences."
				>
					<EdgePairGroups pairs={model.pairs} shared={rowProps} />
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
	readonly renderMarkdown: (el: HTMLElement, markdown: string, sourcePath: string) => Promise<void>;
	readonly onOpenLink: (linktext: string, sourcePath: string) => void;
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
				// Index keys are safe: the list is immutable for the preview's lifetime.
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

/**
 * The edge preview's occurrence lists. ONE pair renders flat — the drawer title
 * already names the from→to. Several pairs (a group-collapsed edge) each get a
 * "source → target" header, so it stays clear which notes every occurrence
 * connects (ticket `nid_tiitgrp5bt7g2niwcvthxw1jk_e`).
 */
function EdgePairGroups({
	pairs,
	shared,
}: {
	readonly pairs: readonly EdgePairGroupModel[];
	readonly shared: SharedRowProps;
}): ReactElement {
	const single = pairs.length === 1 ? pairs[0] : undefined;
	if (single !== undefined) {
		return <RowList rows={single.rows} goPath={single.sourcePath} shared={shared} />;
	}
	return (
		<div className="vicinity-graph-link-preview__groups">
			{pairs.map((pair) => (
				<div key={`${pair.sourcePath}->${pair.targetPath}`} className="vicinity-graph-link-preview__group">
					<h4
						className="vicinity-graph-link-preview__group-title"
						title={`${pair.sourcePath} → ${pair.targetPath}`}
					>
						{`${VaultPathFacts.titleOf(pair.sourcePath)} → ${VaultPathFacts.titleOf(pair.targetPath)}`}
						<span className="vicinity-graph-link-preview__count">{pair.rows.length}</span>
					</h4>
					{pair.rows.length === 0 ? (
						// A pair the occurrence provider answered empty for (cache race) still
						// gets its designed empty state, never a void.
						<p className="vicinity-graph-link-preview__empty">No link occurrences.</p>
					) : (
						<RowList rows={pair.rows} goPath={pair.sourcePath} shared={shared} />
					)}
				</div>
			))}
		</div>
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
				<SnippetMarkdown
					markdown={expanded ? context.expandedContext : context.shortContext}
					sourcePath={goPath}
					renderMarkdown={shared.renderMarkdown}
					onOpenLink={shared.onOpenLink}
				/>
			</button>
			<GoButton
				target={{ path: goPath, line: context.line }}
				renderIcon={shared.renderIcon}
				onGo={shared.onGo}
			/>
		</li>
	);
}

/**
 * One snippet, rendered through Obsidian's markdown renderer (ticket
 * `nid_zlvkl9m4eepitt4efzbhtbhh6_e`) — same ref+effect shape as
 * {@link GoButton}'s icon. Links resolve against `sourcePath`, the note the
 * snippet was read from. Obsidian wires internal-link clicks only inside a
 * real markdown view, so ONE delegated handler routes them out through
 * `onOpenLink`; `stopPropagation` keeps a link click from also toggling the
 * row (the surrounding button).
 */
function SnippetMarkdown({
	markdown,
	sourcePath,
	renderMarkdown,
	onOpenLink,
}: {
	readonly markdown: string;
	readonly sourcePath: string;
	readonly renderMarkdown: (el: HTMLElement, markdown: string, sourcePath: string) => Promise<void>;
	readonly onOpenLink: (linktext: string, sourcePath: string) => void;
}): ReactElement {
	const snippetRef = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (snippetRef.current !== null) {
			// The seam replaces content on every run, so toggles never stack output.
			void renderMarkdown(snippetRef.current, markdown, sourcePath);
		}
	}, [renderMarkdown, markdown, sourcePath]);
	return (
		// A span (not a div): the host is a button, whose content model is phrasing.
		<span
			ref={snippetRef}
			className="vicinity-graph-link-preview__context"
			onClick={(event) => {
				const anchor = (event.target as HTMLElement).closest("a.internal-link");
				if (anchor === null) {
					return; // Plain snippet click: bubble on, the row toggles.
				}
				event.preventDefault();
				event.stopPropagation();
				// Obsidian's renderer stamps the raw linktext on `data-href`.
				const linktext = anchor.getAttribute("data-href") ?? anchor.getAttribute("href");
				if (linktext !== null) {
					onOpenLink(linktext, sourcePath);
				}
			}}
		/>
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
