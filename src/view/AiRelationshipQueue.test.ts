import { describe, expect, it } from "vitest";
import {
	asVaultPath,
	FakeNoteTextProvider,
	FakeRelationshipNamer,
	MIN_AI_CONTENT_CHARS,
} from "../engine";
import type {
	AiNamedRelationship,
	AiNamingConfig,
	DirectedLink,
	NoteTextProvider,
	RelationshipName,
	RelationshipNamingOutcome,
	RelationshipNamingRequest,
	VaultPath,
} from "../engine";
import { AI_MAX_REQUESTS_PER_BUILD, AiRelationshipQueue } from "./AiRelationshipQueue";
import type { AiRelationshipWriterPort } from "./viewPorts";

const CONFIG: AiNamingConfig = { model: "gpt-6-luna", effort: "medium" };
const USAGE = { inputTokens: 1000, outputTokens: 10 };
const PROSE = "p".repeat(MIN_AI_CONTENT_CHARS);
const TOO_SHORT = "p".repeat(MIN_AI_CONTENT_CHARS - 1);

const NAMED: RelationshipNamingOutcome = { kind: "named", name: "extends" as RelationshipName, usage: USAGE };
const DECLINED: RelationshipNamingOutcome = { kind: "declined", reason: "refusal", usage: USAGE };
const NO_KEY: RelationshipNamingOutcome = { kind: "failed", failure: "no-key" };
const RATE_LIMITED: RelationshipNamingOutcome = { kind: "failed", failure: "rate-limited" };

function note(index: number): VaultPath {
	return asVaultPath(`note-${index}.md`);
}

/** Edge `note-0 → note-i`, for i in 1..count. */
function edges(count: number, from = 1): DirectedLink[] {
	return Array.from({ length: count }, (_, offset) => ({ source: note(0), target: note(from + offset) }));
}

/** Every path `edges()` can produce, all with enough prose. */
function proseFor(count: number): Record<string, string> {
	return Object.fromEntries(Array.from({ length: count + 1 }, (_, index) => [note(index), PROSE]));
}

const PLENTY = 50;

class RecordingWriter implements AiRelationshipWriterPort {
	readonly saved: { readonly sourcePath: string; readonly targetPath: string; readonly named: AiNamedRelationship }[] = [];
	saveAiRelationship(sourcePath: string, targetPath: string, named: AiNamedRelationship): Promise<void> {
		this.saved.push({ sourcePath, targetPath, named });
		return Promise.resolve();
	}
}

/** Text reads that wait until {@link open} — the only way to submit a newer build while an older one is still reading. */
class GatedNoteTexts implements NoteTextProvider {
	open: () => void = () => undefined;
	private readonly gate = new Promise<void>((resolve) => {
		this.open = resolve;
	});
	constructor(private readonly texts: Readonly<Record<string, string>>) {}
	async noteTextOf(path: VaultPath): Promise<string | null> {
		await this.gate;
		return this.texts[path] ?? null;
	}
}

/** Lets every pending promise chain run (one macrotask turn) — no timers, no sleeps. */
function settled(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve));
}

function targetsOf(requests: readonly RelationshipNamingRequest[]): string[] {
	return requests.map((request) => /<target_note title="([^"]+)">/.exec(request.prompt.input)?.[1] ?? "?");
}

interface Harness {
	readonly queue: AiRelationshipQueue;
	readonly namer: FakeRelationshipNamer;
	readonly writer: RecordingWriter;
}

function given(
	answer: (request: RelationshipNamingRequest) => RelationshipNamingOutcome = () => NAMED,
	texts: NoteTextProvider = new FakeNoteTextProvider(proseFor(PLENTY)),
): Harness {
	const namer = new FakeRelationshipNamer(answer);
	const writer = new RecordingWriter();
	return { queue: new AiRelationshipQueue(namer, texts, writer), namer, writer };
}

describe("AiRelationshipQueue — asking", () => {
	it("WHEN both notes have enough prose THEN the namer is asked once for the pair", async () => {
		const { queue, namer } = given();
		await queue.submitBuild(edges(1), CONFIG);
		expect(namer.requests.length).toBe(1);
	});

	it("WHEN asked THEN the prompt carries the target note's title", async () => {
		const { queue, namer } = given();
		await queue.submitBuild(edges(1), CONFIG);
		expect(targetsOf(namer.requests)).toEqual(["note-1"]);
	});

	it("WHEN asked THEN the configured model and effort go with the request", async () => {
		const { queue, namer } = given();
		await queue.submitBuild(edges(1), CONFIG);
		expect(namer.requests[0]?.config).toEqual(CONFIG);
	});

	it("WHEN the target has too little prose THEN the namer is not asked", async () => {
		const { queue, namer } = given(undefined, new FakeNoteTextProvider({ [note(0)]: PROSE, [note(1)]: TOO_SHORT }));
		await queue.submitBuild(edges(1), CONFIG);
		expect(namer.requests).toEqual([]);
	});

	it("WHEN the source has too little prose THEN the namer is not asked", async () => {
		const { queue, namer } = given(undefined, new FakeNoteTextProvider({ [note(0)]: TOO_SHORT, [note(1)]: PROSE }));
		await queue.submitBuild(edges(1), CONFIG);
		expect(namer.requests).toEqual([]);
	});

	it("WHEN a note cannot be read THEN the namer is not asked", async () => {
		const { queue, namer } = given(undefined, new FakeNoteTextProvider({ [note(0)]: PROSE }));
		await queue.submitBuild(edges(1), CONFIG);
		expect(namer.requests).toEqual([]);
	});
});

describe("AiRelationshipQueue — storing", () => {
	it("WHEN the model names a pair THEN the name is written with the model, effort and usage", async () => {
		const { queue, writer } = given();
		await queue.submitBuild(edges(1), CONFIG);
		expect(writer.saved).toEqual([
			{
				sourcePath: "note-0.md",
				targetPath: "note-1.md",
				named: { name: "extends", model: "gpt-6-luna", effort: "medium", usage: USAGE },
			},
		]);
	});

	it("WHEN the model declines THEN nothing is written", async () => {
		const { queue, writer } = given(() => DECLINED);
		await queue.submitBuild(edges(1), CONFIG);
		expect(writer.saved).toEqual([]);
	});
});

describe("AiRelationshipQueue — dedupe", () => {
	it("WHEN the same pair is submitted again while its request is in flight THEN it is asked once", async () => {
		const { queue, namer } = given();
		namer.holdAnswers();
		const first = queue.submitBuild(edges(1), CONFIG);
		await settled();
		const second = queue.submitBuild(edges(1), CONFIG);
		await settled();
		namer.releaseAll();
		await Promise.all([first, second]);
		expect(namer.requests.length).toBe(1);
	});

	it("WHEN one build lists the same pair twice THEN it is asked once", async () => {
		const { queue, namer } = given();
		await queue.submitBuild([...edges(1), ...edges(1)], CONFIG);
		expect(namer.requests.length).toBe(1);
	});

	it("WHEN a pair was named THEN a later build does not ask about it again", async () => {
		const { queue, namer } = given();
		await queue.submitBuild(edges(1), CONFIG);
		await queue.submitBuild(edges(1), CONFIG);
		expect(namer.requests.length).toBe(1);
	});

	it("WHEN a pair was declined THEN a later build does not ask about it again", async () => {
		const { queue, namer } = given(() => DECLINED);
		await queue.submitBuild(edges(1), CONFIG);
		await queue.submitBuild(edges(1), CONFIG);
		expect(namer.requests.length).toBe(1);
	});

	it("WHEN a pair's request failed transiently THEN a later build asks again", async () => {
		const { queue, namer } = given(() => RATE_LIMITED);
		await queue.submitBuild(edges(1), CONFIG);
		await queue.submitBuild(edges(1), CONFIG);
		expect(namer.requests.length).toBe(2);
	});

	it("WHEN only the REVERSE pair was named THEN this direction is still asked", async () => {
		const { queue, namer } = given();
		await queue.submitBuild([{ source: note(1), target: note(0) }], CONFIG);
		await queue.submitBuild(edges(1), CONFIG);
		expect(namer.requests.length).toBe(2);
	});
});

describe("AiRelationshipQueue — cap", () => {
	it(`WHEN a build has more candidates than the cap THEN only ${AI_MAX_REQUESTS_PER_BUILD} requests are sent`, async () => {
		const { queue, namer } = given();
		await queue.submitBuild(edges(AI_MAX_REQUESTS_PER_BUILD + 5), CONFIG);
		expect(namer.requests.length).toBe(AI_MAX_REQUESTS_PER_BUILD);
	});

	it("WHEN the cap is reached THEN the earliest candidates are the ones asked", async () => {
		const { queue, namer } = given();
		await queue.submitBuild(edges(AI_MAX_REQUESTS_PER_BUILD + 1), CONFIG);
		expect(targetsOf(namer.requests)).not.toContain(`note-${AI_MAX_REQUESTS_PER_BUILD + 1}`);
	});

	it("WHEN the next build comes THEN it may start up to the cap again", async () => {
		const { queue, namer } = given();
		await queue.submitBuild(edges(AI_MAX_REQUESTS_PER_BUILD + 5), CONFIG);
		await queue.submitBuild(edges(AI_MAX_REQUESTS_PER_BUILD + 5), CONFIG);
		expect(namer.requests.length).toBe(AI_MAX_REQUESTS_PER_BUILD + 5);
	});

	it("WHEN a build is at the cap THEN all its requests are in flight at once", async () => {
		const { queue, namer } = given();
		namer.holdAnswers();
		const build = queue.submitBuild(edges(AI_MAX_REQUESTS_PER_BUILD), CONFIG);
		await settled();
		const inFlight = queue.status().inFlight;
		namer.releaseAll();
		await build;
		expect(inFlight).toBe(AI_MAX_REQUESTS_PER_BUILD);
	});

	it("WHEN pairs are skipped for too little prose THEN they do not use up the cap", async () => {
		const texts = { ...proseFor(PLENTY), [note(1)]: TOO_SHORT };
		const { queue, namer } = given(undefined, new FakeNoteTextProvider(texts));
		await queue.submitBuild(edges(AI_MAX_REQUESTS_PER_BUILD + 1), CONFIG);
		expect(namer.requests.length).toBe(AI_MAX_REQUESTS_PER_BUILD);
	});
});

describe("AiRelationshipQueue — fatal stop", () => {
	it("WHEN a request fails fatally THEN the rest of the build is not asked", async () => {
		const { queue, namer } = given(() => NO_KEY);
		await queue.submitBuild(edges(3), CONFIG);
		expect(namer.requests.length).toBe(1);
	});

	it("WHEN a request fails fatally THEN the queue reports it stopped", async () => {
		const { queue } = given(() => NO_KEY);
		await queue.submitBuild(edges(1), CONFIG);
		expect(queue.status().stopped).toBe(true);
	});

	it("WHEN stopped THEN a later build asks nothing", async () => {
		const { queue, namer } = given(() => NO_KEY);
		await queue.submitBuild(edges(1), CONFIG);
		await queue.submitBuild(edges(2, 2), CONFIG);
		expect(namer.requests.length).toBe(1);
	});

	it("WHEN stopped and then resumed THEN the next build asks again", async () => {
		let answer: RelationshipNamingOutcome = NO_KEY;
		const { queue, namer } = given(() => answer);
		await queue.submitBuild(edges(1), CONFIG);
		answer = NAMED;
		queue.resume();
		await queue.submitBuild(edges(1), CONFIG);
		expect(namer.requests.length).toBe(2);
	});

	it("WHEN a request fails transiently THEN the rest of the build is still asked", async () => {
		const { queue, namer } = given(() => RATE_LIMITED);
		await queue.submitBuild(edges(3), CONFIG);
		expect(namer.requests.length).toBe(3);
	});
});

describe("AiRelationshipQueue — latest build wins", () => {
	it("WHEN a newer build arrives while the older one is still reading notes THEN the older one's pairs are dropped", async () => {
		const texts = new GatedNoteTexts(proseFor(PLENTY));
		const { queue, namer } = given(undefined, texts);
		const older = queue.submitBuild(edges(2), CONFIG);
		const newer = queue.submitBuild(edges(1, 3), CONFIG);
		texts.open();
		await Promise.all([older, newer]);
		expect(targetsOf(namer.requests)).toEqual(["note-3"]);
	});

	it("WHEN a newer build arrives while the older one's request is in flight THEN that request still finishes and is stored", async () => {
		const { queue, namer, writer } = given();
		namer.holdAnswers();
		const older = queue.submitBuild(edges(1), CONFIG);
		await settled();
		const newer = queue.submitBuild([], CONFIG);
		namer.releaseAll();
		await Promise.all([older, newer]);
		expect(writer.saved.map((save) => save.targetPath)).toEqual(["note-1.md"]);
	});

	it("WHEN pending work is cancelled while notes are being read THEN nothing is asked", async () => {
		const texts = new GatedNoteTexts(proseFor(PLENTY));
		const { queue, namer } = given(undefined, texts);
		const build = queue.submitBuild(edges(2), CONFIG);
		queue.cancelPending();
		texts.open();
		await build;
		expect(namer.requests).toEqual([]);
	});

	it("WHEN a dropped pair is submitted again THEN it is asked (dropping released it)", async () => {
		const texts = new GatedNoteTexts(proseFor(PLENTY));
		const { queue, namer } = given(undefined, texts);
		const build = queue.submitBuild(edges(1), CONFIG);
		queue.cancelPending();
		texts.open();
		await build;
		await queue.submitBuild(edges(1), CONFIG);
		expect(namer.requests.length).toBe(1);
	});
});

describe("AiRelationshipQueue — session status", () => {
	it("WHEN nothing was submitted THEN the status is idle", () => {
		expect(given().queue.status()).toEqual({
			inFlight: 0,
			named: 0,
			declined: 0,
			failed: 0,
			inputTokens: 0,
			outputTokens: 0,
			lastFailure: null,
			stopped: false,
		});
	});

	it("WHEN pairs are named, declined and fail THEN each is counted, tokens summed, the failure remembered", async () => {
		const answers = [NAMED, DECLINED, RATE_LIMITED];
		const { queue } = given(() => answers.shift() ?? NAMED);
		await queue.submitBuild(edges(3), CONFIG);
		expect(queue.status()).toEqual({
			inFlight: 0,
			named: 1,
			declined: 1,
			failed: 1,
			inputTokens: 2 * USAGE.inputTokens,
			outputTokens: 2 * USAGE.outputTokens,
			lastFailure: "rate-limited",
			stopped: false,
		});
	});

	it("WHEN resumed THEN the last failure is cleared", async () => {
		const { queue } = given(() => NO_KEY);
		await queue.submitBuild(edges(1), CONFIG);
		queue.resume();
		expect(queue.status().lastFailure).toBeNull();
	});

	it("WHEN nothing changed THEN status() returns the same snapshot object", () => {
		const { queue } = given();
		expect(queue.status()).toBe(queue.status());
	});

	it("WHEN the status changes THEN a subscriber is told", async () => {
		const { queue } = given();
		let calls = 0;
		queue.subscribe(() => {
			calls += 1;
		});
		await queue.submitBuild(edges(1), CONFIG);
		expect(calls).toBeGreaterThan(0);
	});

	it("WHEN a subscriber unsubscribed THEN it is no longer told", async () => {
		const { queue } = given();
		let calls = 0;
		const unsubscribe = queue.subscribe(() => {
			calls += 1;
		});
		unsubscribe();
		await queue.submitBuild(edges(1), CONFIG);
		expect(calls).toBe(0);
	});

	it("WHEN a namer breaks its contract and rejects THEN the build still resolves and the request counts as failed", async () => {
		const brokenNamer = {
			nameRelationship: (): Promise<RelationshipNamingOutcome> => Promise.reject(new Error("boom")),
		};
		const queue = new AiRelationshipQueue(brokenNamer, new FakeNoteTextProvider(proseFor(1)), new RecordingWriter());
		await queue.submitBuild(edges(1), CONFIG);
		expect(queue.status().failed).toBe(1);
	});
});
