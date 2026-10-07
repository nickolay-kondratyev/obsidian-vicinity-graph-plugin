/**
 * Where the OpenAI key comes from, resolved at CALL time (task 3/4
 * `nid_cbnhpdfn4myqfzqr8weyg7kq5_e`) so a key picked or exported after startup is
 * used on the next request. The key is NEVER logged, stored by us, or put in an
 * error — callers only pass it to the HTTP header. Tests use `FakeApiKeySource`.
 */
export interface ApiKeySource {
	/** The key, or `null` when none is configured. */
	apiKey(): string | null;
}

/** Structural slice of Obsidian's `SecretStorage` (`app.secretStorage`, since 1.11.4). */
export interface SecretReaderPort {
	getSecret(id: string): string | null;
}

/** Environment variable the fallback reads — OpenAI's own convention, so an existing shell setup just works. */
export const OPENAI_API_KEY_ENV_VAR = "OPENAI_API_KEY";

/**
 * The secret NAMED in settings (Obsidian keeps it outside the vault, per device,
 * OS-encrypted) when it holds a key, else `OPENAI_API_KEY` from the environment
 * Obsidian was started with. WHY the env is read even with a secret name set: a
 * chosen secret that is empty would otherwise leave the user keyless while the
 * "no key" copy tells them the env var works.
 */
export class SecretOrEnvApiKeySource implements ApiKeySource {
	constructor(
		private readonly secrets: SecretReaderPort,
		/** The secret's NAME from settings; `""` = none chosen. */
		private readonly secretName: () => string,
		/** Reads one environment variable; injected so tests never touch `process.env`. */
		private readonly readEnv: (name: string) => string | undefined,
	) {}

	apiKey(): string | null {
		return SecretOrEnvApiKeySource.nonEmpty(this.secretKey()) ?? SecretOrEnvApiKeySource.nonEmpty(this.readEnv(OPENAI_API_KEY_ENV_VAR));
	}

	private secretKey(): string | null {
		const name = this.secretName();
		return name.length === 0 ? null : this.secrets.getSecret(name);
	}

	private static nonEmpty(key: string | null | undefined): string | null {
		const trimmed = key?.trim() ?? "";
		return trimmed.length === 0 ? null : trimmed;
	}
}
