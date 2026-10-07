import { describe, expect, it } from "vitest";
import { asVaultPath, FakeNoteTextProvider, FakeRelationshipNamer, MIN_AI_CONTENT_CHARS } from "../engine";
import type { RelationshipNamingOutcome } from "../engine";
import { aiNamingFailureCopy } from "./aiNamingFailureCopy";
import { AiNamingFailureNotices } from "./AiNamingFailureNotices";
import { AiRelationshipQueue } from "./AiRelationshipQueue";
import { FakeUserNotices } from "./FakeUserNotices";

const CONFIG = { model: "gpt-6-luna", effort: "medium" } as const;
const SOURCE = asVaultPath("a.md");
const PROSE = "p".repeat(MIN_AI_CONTENT_CHARS);
const RATE_LIMITED: RelationshipNamingOutcome = { kind: "failed", failure: "rate-limited" };
const NETWORK: RelationshipNamingOutcome = { kind: "failed", failure: "network" };

function edgeTo(index: number): { source: typeof SOURCE; target: ReturnType<typeof asVaultPath> } {
	return { source: SOURCE, target: asVaultPath(`t-${index}.md`) };
}

function given(answer: () => RelationshipNamingOutcome): { queue: AiRelationshipQueue; notices: FakeUserNotices } {
	const texts = new FakeNoteTextProvider({ [SOURCE]: PROSE, "t-0.md": PROSE, "t-1.md": PROSE, "t-2.md": PROSE });
	const queue = new AiRelationshipQueue(new FakeRelationshipNamer(answer), texts, { saveAiRelationship: () => Promise.resolve() });
	const notices = new FakeUserNotices();
	new AiNamingFailureNotices(queue, notices).start();
	return { queue, notices };
}

describe("AiNamingFailureNotices", () => {
	it("WHEN a request fails THEN the user is told what went wrong and how to fix it", async () => {
		const { queue, notices } = given(() => RATE_LIMITED);
		await queue.submitBuild([edgeTo(0)], CONFIG);
		expect(notices.messages).toEqual([aiNamingFailureCopy("rate-limited")]);
	});

	it("WHEN the same failure happens on later redraws THEN the user is told only once", async () => {
		const { queue, notices } = given(() => RATE_LIMITED);
		await queue.submitBuild([edgeTo(0)], CONFIG);
		await queue.submitBuild([edgeTo(1)], CONFIG);
		await queue.submitBuild([edgeTo(2)], CONFIG);
		expect(notices.messages.length).toBe(1);
	});

	it("WHEN a different failure follows THEN the user is told about it too", async () => {
		const answers = [RATE_LIMITED, NETWORK];
		const { queue, notices } = given(() => answers.shift() ?? NETWORK);
		await queue.submitBuild([edgeTo(0)], CONFIG);
		await queue.submitBuild([edgeTo(1)], CONFIG);
		expect(notices.messages).toEqual([aiNamingFailureCopy("rate-limited"), aiNamingFailureCopy("network")]);
	});
});
