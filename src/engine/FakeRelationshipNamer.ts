import type { RelationshipNamer, RelationshipNamingOutcome, RelationshipNamingRequest } from "./RelationshipNamer";

/**
 * Scriptable {@link RelationshipNamer}. Every call is recorded; each answer comes
 * from `answer(request)`, and with {@link holdAnswers} a call stays PENDING until
 * the test releases it — the only way to observe "in flight" without timers.
 */
export class FakeRelationshipNamer implements RelationshipNamer {
	readonly requests: RelationshipNamingRequest[] = [];
	private readonly held: (() => void)[] = [];
	private holding = false;

	constructor(private readonly answer: (request: RelationshipNamingRequest) => RelationshipNamingOutcome) {}

	nameRelationship(request: RelationshipNamingRequest): Promise<RelationshipNamingOutcome> {
		this.requests.push(request);
		const outcome = this.answer(request);
		if (!this.holding) {
			return Promise.resolve(outcome);
		}
		return new Promise((resolve) => this.held.push(() => resolve(outcome)));
	}

	/** From now on, calls stay pending until {@link releaseAll}. */
	holdAnswers(): void {
		this.holding = true;
	}

	/** Answers every pending call and stops holding. */
	releaseAll(): void {
		this.holding = false;
		for (const release of this.held.splice(0)) {
			release();
		}
	}
}
