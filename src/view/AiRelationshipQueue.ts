import type {
	AiNamingConfig,
	AiNamingFailure,
	DirectedLink,
	NoteTextProvider,
	RelationshipNamer,
	RelationshipNamingOutcome,
	RelationshipNamingRequest,
	RelationshipPrompt,
	RelationshipTokenUsage,
} from "../engine";
import { buildRelationshipPrompt, directedLinkKey, hasEnoughAiContent, isFatalAiNamingFailure } from "../engine";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import type { AiRelationshipWriterPort } from "./viewPorts";

/**
 * Most NEW naming requests one graph redraw may start; all of them may run at
 * once. WHY: the cost ceiling of auto mode (human decision 2026-10-06) — a big
 * graph never sends more than this per redraw, and stored names make a later
 * redraw free for already-named pairs.
 */
export const AI_MAX_REQUESTS_PER_BUILD = 20;

/** The session's naming progress, for the task 4/4 status line ("Naming 3 of 12…", "Named 12 (≈N tokens)", the last error). */
export interface AiNamingStatus {
	/** Submitted builds still choosing what to send (reading notes) — busy before any request is in flight. */
	readonly preparing: number;
	/** Requests sent and not answered yet. */
	readonly inFlight: number;
	/**
	 * Requests sent in the current RUN — a run starts when a request goes out while
	 * none is in flight, so "Naming 3 of 12…" counts one burst, not the whole session.
	 */
	readonly runRequested: number;
	/** Requests of the current run that got an answer (of any kind). */
	readonly runAnswered: number;
	/** Pairs the model named this session. */
	readonly named: number;
	/** Pairs the model answered without a usable name (refusal, invalid name, notes too long). */
	readonly declined: number;
	/** Requests that failed (no key, bad key, network, …). */
	readonly failed: number;
	readonly inputTokens: number;
	readonly outputTokens: number;
	/**
	 * The CURRENT problem, for the plain-language status: the most recent failure,
	 * `null` until one happens, after {@link AiRelationshipQueue.resume}, or once a
	 * later request got an answer again (a transient failure is over by then; a fatal
	 * one stays until resumed).
	 */
	readonly lastFailure: AiNamingFailure | null;
	/** True after a FATAL failure: nothing more is sent until {@link AiRelationshipQueue.resume}. */
	readonly stopped: boolean;
}

const IDLE_STATUS: AiNamingStatus = {
	preparing: 0,
	inFlight: 0,
	runRequested: 0,
	runAnswered: 0,
	named: 0,
	declined: 0,
	failed: 0,
	inputTokens: 0,
	outputTokens: 0,
	lastFailure: null,
	stopped: false,
};

/**
 * Auto mode's request queue (task 3/4 `nid_cbnhpdfn4myqfzqr8weyg7kq5_e`). The
 * caller (task 4/4: `GraphViewController`, after each build) hands it the build's
 * AI-CANDIDATE edges (`aiCandidateEdges` — the text-free half of eligibility);
 * the queue reads both notes, applies the content half, and asks the
 * {@link RelationshipNamer}, writing every name through the
 * {@link AiRelationshipWriterPort} (origin `ai`, model, effort, usage), whose
 * guarded write repaints every view.
 *
 * - DEDUPE: a pair being read or asked about is never asked again meanwhile, and a
 *   pair that got an ANSWER (named or declined) is not asked again this session.
 * - CAP: at most {@link AI_MAX_REQUESTS_PER_BUILD} new requests per submitted build.
 * - LATEST BUILD WINS: a newer {@link submitBuild} (or {@link cancelPending})
 *   drops the older build's not-yet-started pairs; requests already sent finish
 *   and are stored — their cost is paid.
 * - FATAL STOP: a failure that would fail every request alike (no / bad key,
 *   unknown model, no quota, rejected request) stops the queue until
 *   {@link resume}, instead of hammering.
 *
 * Known ceiling for task 4/4's wiring: each stored name repaints every view, and a
 * repaint is a new build. If every repaint is submitted, the cap holds per BUILD
 * but not per user action (20 answers → 20 repaints → more requests). 4/4 decides
 * which builds to submit.
 */
export class AiRelationshipQueue {
	/** Bumped by every submit / cancel; a build whose number is stale starts nothing more. */
	private generation = 0;
	/** Pairs being read or asked about right now — {@link directedLinkKey}. */
	private readonly claimed = new Set<string>();
	/** Pairs that got an answer this session (named or declined) — never asked again. */
	private readonly answered = new Set<string>();
	private current: AiNamingStatus = IDLE_STATUS;
	private readonly listeners = new Set<() => void>();

	constructor(
		private readonly namer: RelationshipNamer,
		private readonly texts: NoteTextProvider,
		private readonly writer: AiRelationshipWriterPort,
	) {}

	/**
	 * Names what it may of `edges` (in order) with `config`. Resolves once every
	 * request THIS build started is answered and stored — callers `void` it; tests
	 * await it. Never rejects.
	 */
	async submitBuild(edges: readonly DirectedLink[], config: AiNamingConfig): Promise<void> {
		this.generation += 1;
		const generation = this.generation;
		const started: Promise<void>[] = [];
		this.update({ preparing: this.current.preparing + 1 });
		try {
			for (const edge of edges) {
				if (started.length >= AI_MAX_REQUESTS_PER_BUILD || !this.mayStart(generation)) {
					break;
				}
				const key = directedLinkKey(edge.source, edge.target);
				if (this.claimed.has(key) || this.answered.has(key)) {
					continue;
				}
				this.claimed.add(key);
				const prompt = await this.promptFor(edge);
				if (prompt === null || !this.mayStart(generation)) {
					this.claimed.delete(key);
					continue;
				}
				started.push(this.ask(key, edge, { prompt, config }));
			}
		} finally {
			this.update({ preparing: this.current.preparing - 1 });
		}
		await Promise.all(started);
	}

	/** Drops not-yet-started work (task 4/4: auto mode turned OFF). Requests already sent finish. */
	cancelPending(): void {
		this.generation += 1;
	}

	/** Lifts a fatal stop (task 4/4: the user fixed the key or model) — the next submitted build runs. */
	resume(): void {
		this.update({ stopped: false, lastFailure: null });
	}

	/** The current status; the SAME object until something changes (a `useSyncExternalStore` snapshot). */
	status(): AiNamingStatus {
		return this.current;
	}

	/** Calls `listener` after every status change; returns the unsubscribe. */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private mayStart(generation: number): boolean {
		return generation === this.generation && !this.current.stopped;
	}

	/** The prompt for `edge`, or `null` when either note is unreadable or holds too little prose. */
	private async promptFor(edge: DirectedLink): Promise<RelationshipPrompt | null> {
		const [sourceText, targetText] = await Promise.all([
			this.texts.noteTextOf(edge.source),
			this.texts.noteTextOf(edge.target),
		]);
		if (sourceText === null || targetText === null || !hasEnoughAiContent(sourceText) || !hasEnoughAiContent(targetText)) {
			return null;
		}
		return buildRelationshipPrompt(
			{ title: VaultPathFacts.titleOf(edge.source), text: sourceText },
			{ title: VaultPathFacts.titleOf(edge.target), text: targetText },
		);
	}

	private async ask(key: string, edge: DirectedLink, request: RelationshipNamingRequest): Promise<void> {
		const startsRun = this.current.inFlight === 0;
		this.update({
			inFlight: this.current.inFlight + 1,
			runRequested: startsRun ? 1 : this.current.runRequested + 1,
			runAnswered: startsRun ? 0 : this.current.runAnswered,
		});
		try {
			await this.settle(key, edge, request.config, await this.outcomeOf(request));
		} finally {
			this.claimed.delete(key);
			this.update({ inFlight: this.current.inFlight - 1, runAnswered: this.current.runAnswered + 1 });
		}
	}

	/** The namer's contract is "never rejects"; a broken one must still release the pair and count, not reject `submitBuild`. */
	private async outcomeOf(request: RelationshipNamingRequest): Promise<RelationshipNamingOutcome> {
		try {
			return await this.namer.nameRelationship(request);
		} catch {
			return { kind: "failed", failure: "unexpected-response" };
		}
	}

	private async settle(key: string, edge: DirectedLink, config: AiNamingConfig, outcome: RelationshipNamingOutcome): Promise<void> {
		switch (outcome.kind) {
			case "named":
				this.answered.add(key);
				await this.writer.saveAiRelationship(edge.source, edge.target, {
					name: outcome.name,
					model: config.model,
					effort: config.effort,
					usage: outcome.usage,
				});
				this.update({ named: this.current.named + 1, ...this.answeredAgain(), ...this.tokensAdding(outcome.usage) });
				return;
			case "declined":
				this.answered.add(key);
				this.update({ declined: this.current.declined + 1, ...this.answeredAgain(), ...this.tokensAdding(outcome.usage) });
				return;
			case "failed":
				this.update({
					failed: this.current.failed + 1,
					lastFailure: outcome.failure,
					stopped: this.current.stopped || isFatalAiNamingFailure(outcome.failure),
				});
				return;
		}
	}

	/** An answer ends a TRANSIENT failure (the status stops showing it); a fatal one stays until {@link resume}. */
	private answeredAgain(): Pick<AiNamingStatus, "lastFailure"> {
		return { lastFailure: this.current.stopped ? this.current.lastFailure : null };
	}

	private tokensAdding(usage: RelationshipTokenUsage | null): Pick<AiNamingStatus, "inputTokens" | "outputTokens"> {
		return {
			inputTokens: this.current.inputTokens + (usage?.inputTokens ?? 0),
			outputTokens: this.current.outputTokens + (usage?.outputTokens ?? 0),
		};
	}

	private update(change: Partial<AiNamingStatus>): void {
		this.current = { ...this.current, ...change };
		for (const listener of this.listeners) {
			listener();
		}
	}
}
