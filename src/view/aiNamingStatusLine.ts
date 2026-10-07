import { aiNamingFailureCopy } from "./aiNamingFailureCopy";
import type { AiNamingStatus } from "./AiRelationshipQueue";

/**
 * The Relationships menu's one status line (task 4/4
 * `nid_80xc6z8umlpo1x6u4p1v7eb22_e`), decided from the queue's session status.
 * `stopped` is the only kind the menu offers a Retry for: auto mode sends nothing
 * more until the user acts. Pure, so every case is a table row in its test.
 */
export type AiNamingStatusLine =
	/** A fatal failure stopped auto mode (missing / refused key, unknown model, no credit…). */
	| { readonly kind: "stopped"; readonly text: string }
	/** Requests are being prepared or are in flight. */
	| { readonly kind: "busy"; readonly text: string }
	/** The last request failed in a way a later redraw may get past (rate limit, network…). */
	| { readonly kind: "problem"; readonly text: string }
	/** Idle: what this session has done so far. */
	| { readonly kind: "idle"; readonly text: string };

/** Token counts read as `12,345` — the user's vocabulary, not a raw integer. */
const TOKEN_COUNT_FORMAT = new Intl.NumberFormat("en-US");

export function aiNamingStatusLine(status: AiNamingStatus, autoNaming: boolean): AiNamingStatusLine {
	if (status.stopped && status.lastFailure !== null) {
		return { kind: "stopped", text: aiNamingFailureCopy(status.lastFailure) };
	}
	if (status.inFlight > 0) {
		return { kind: "busy", text: `Naming ${status.runAnswered} of ${status.runRequested}…` };
	}
	if (status.preparing > 0) {
		return { kind: "busy", text: "Naming…" };
	}
	if (status.lastFailure !== null) {
		return { kind: "problem", text: aiNamingFailureCopy(status.lastFailure) };
	}
	if (status.named > 0) {
		const tokens = TOKEN_COUNT_FORMAT.format(status.inputTokens + status.outputTokens);
		return { kind: "idle", text: `Named ${status.named} this session (≈${tokens} tokens)` };
	}
	return { kind: "idle", text: autoNaming ? "Nothing named yet this session." : "AI naming is off." };
}
