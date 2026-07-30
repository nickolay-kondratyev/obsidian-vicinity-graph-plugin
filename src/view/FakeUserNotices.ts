import type { UserNoticePort } from "./viewPorts";

/**
 * Test stand-in for Obsidian's `Notice`: every message a subject would have shown the
 * user, in order. An ACCUMULATING list rather than a "last message" field, because the
 * property most worth asserting is a COUNT — "the user was told exactly once" is what
 * separates one honest failure notice from a burst of duplicates.
 */
export class FakeUserNotices implements UserNoticePort {
	readonly messages: string[] = [];

	show(message: string): void {
		this.messages.push(message);
	}
}
