import type { ApiKeySource } from "./ApiKeySource";

/** A fixed key (or none) — the test double. */
export class FakeApiKeySource implements ApiKeySource {
	constructor(private readonly key: string | null) {}

	apiKey(): string | null {
		return this.key;
	}
}
