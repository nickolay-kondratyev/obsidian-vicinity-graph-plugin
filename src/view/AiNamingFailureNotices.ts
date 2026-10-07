import type { AiNamingFailure } from "../engine";
import { aiNamingFailureCopy } from "./aiNamingFailureCopy";
import type { AiNamingStatus } from "./AiRelationshipQueue";
import type { UserNoticePort } from "./viewPorts";

/** The slice of the queue this reads — its status, and a way to hear it change. */
export interface AiNamingStatusSource {
	status(): AiNamingStatus;
	subscribe(listener: () => void): () => void;
}

/**
 * Tells the user when AI naming fails (task 4/4 `nid_80xc6z8umlpo1x6u4p1v7eb22_e`) —
 * ONCE per failure kind per session, so a rate limit hit on every redraw is one
 * toast, not twenty. The Relationships menu's status line keeps showing the current
 * problem; this is only the heads-up for a user who is not looking at it.
 * Plugin-lived, like the queue it watches.
 */
export class AiNamingFailureNotices {
	private readonly told = new Set<AiNamingFailure>();

	constructor(
		private readonly source: AiNamingStatusSource,
		private readonly notices: UserNoticePort,
	) {}

	/** Starts watching; returns the stop. */
	start(): () => void {
		return this.source.subscribe(() => this.statusChanged());
	}

	private statusChanged(): void {
		const failure = this.source.status().lastFailure;
		if (failure === null || this.told.has(failure)) {
			return;
		}
		this.told.add(failure);
		this.notices.show(aiNamingFailureCopy(failure));
	}
}
