import type { ViewsRefreshPort } from "./viewPorts";

/**
 * Test stand-in for the plugin's leaf walk: it is constructed with the ids of
 * the views a fake workspace has open, and every `refreshAllViews()` appends ALL
 * of them to {@link refreshedViewIds}. Tests therefore assert on WHICH views a
 * write reached (the bug was "only the originating one"), and the accumulating
 * list also makes a double fan-out visible.
 */
export class FakeViewsRefresh implements ViewsRefreshPort {
	readonly refreshedViewIds: string[] = [];

	constructor(private readonly openViewIds: readonly string[]) {}

	refreshAllViews(): void {
		this.refreshedViewIds.push(...this.openViewIds);
	}
}
