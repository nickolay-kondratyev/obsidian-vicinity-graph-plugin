/**
 * Collapse/expand state of the link-preview modal's context rows (parent
 * ticket `nid_tohotgq2s92dvd1iov1rd0umv_e`). Immutable: every transition
 * returns a new state, so a React `useState` holds it directly.
 *
 * Row ids are a built model's `rowIds` (see `src/view/linkPreviewModel.ts`).
 */

/** Derived Expand-all / Collapse-all button enablement. */
export interface BulkToggleEnablement {
	readonly expandAllEnabled: boolean;
	readonly collapseAllEnabled: boolean;
}

export class ContextRowCollapseState {
	private constructor(
		private readonly rowIds: readonly string[],
		private readonly expandedIds: ReadonlySet<string>,
	) {}

	/** Every context row starts COLLAPSED (parent-ticket requirement). */
	static allCollapsed(rowIds: readonly string[]): ContextRowCollapseState {
		if (new Set(rowIds).size !== rowIds.length) {
			// A duplicate id would silently yoke two rows' state together.
			throw new Error(`Duplicate context row ids: [${rowIds.join(", ")}]`);
		}
		return new ContextRowCollapseState(rowIds, new Set());
	}

	isExpanded(rowId: string): boolean {
		return this.expandedIds.has(rowId);
	}

	/** Flips ONE row; every other row is untouched. Unknown ids are a caller bug. */
	toggled(rowId: string): ContextRowCollapseState {
		if (!this.rowIds.includes(rowId)) {
			throw new Error(`Unknown context row id: [${rowId}]`);
		}
		const expandedIds = new Set(this.expandedIds);
		if (!expandedIds.delete(rowId)) {
			expandedIds.add(rowId);
		}
		return new ContextRowCollapseState(this.rowIds, expandedIds);
	}

	expandedAll(): ContextRowCollapseState {
		return new ContextRowCollapseState(this.rowIds, new Set(this.rowIds));
	}

	collapsedAll(): ContextRowCollapseState {
		return new ContextRowCollapseState(this.rowIds, new Set());
	}

	/**
	 * All collapsed → only Expand all; all expanded → only Collapse all; mixed →
	 * both. Zero rows are vacuously both, so BOTH buttons disable — there is
	 * nothing either could do.
	 */
	enablement(): BulkToggleEnablement {
		return {
			expandAllEnabled: this.expandedIds.size < this.rowIds.length,
			collapseAllEnabled: this.expandedIds.size > 0,
		};
	}
}
