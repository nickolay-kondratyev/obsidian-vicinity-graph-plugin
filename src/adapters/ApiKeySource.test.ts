import { describe, expect, it } from "vitest";
import { OPENAI_API_KEY_ENV_VAR, SecretOrEnvApiKeySource } from "./ApiKeySource";
import type { SecretReaderPort } from "./ApiKeySource";

const SECRET_NAME = "openai-key";
const SECRET_KEY = "sk-from-secret";
const ENV_KEY = "sk-from-env";

class FakeSecrets implements SecretReaderPort {
	readonly asked: string[] = [];
	constructor(private readonly secrets: Readonly<Record<string, string>>) {}
	getSecret(id: string): string | null {
		this.asked.push(id);
		return this.secrets[id] ?? null;
	}
}

interface Given {
	readonly secrets?: Readonly<Record<string, string>>;
	readonly secretName?: string;
	readonly env?: Readonly<Record<string, string>>;
}

function source(given: Given): SecretOrEnvApiKeySource {
	const env = given.env ?? {};
	return new SecretOrEnvApiKeySource(
		new FakeSecrets(given.secrets ?? {}),
		() => given.secretName ?? "",
		(name) => env[name],
	);
}

describe("SecretOrEnvApiKeySource", () => {
	it("WHEN a chosen secret holds a key THEN that key is used", () => {
		expect(source({ secrets: { [SECRET_NAME]: SECRET_KEY }, secretName: SECRET_NAME, env: { [OPENAI_API_KEY_ENV_VAR]: ENV_KEY } }).apiKey()).toBe(SECRET_KEY);
	});

	it("WHEN no secret is chosen THEN OPENAI_API_KEY is used", () => {
		expect(source({ env: { [OPENAI_API_KEY_ENV_VAR]: ENV_KEY } }).apiKey()).toBe(ENV_KEY);
	});

	it("WHEN the chosen secret is missing THEN OPENAI_API_KEY is used", () => {
		expect(source({ secretName: SECRET_NAME, env: { [OPENAI_API_KEY_ENV_VAR]: ENV_KEY } }).apiKey()).toBe(ENV_KEY);
	});

	it("WHEN neither a secret nor the env var holds a key THEN there is no key", () => {
		expect(source({ secretName: SECRET_NAME }).apiKey()).toBeNull();
	});

	it("WHEN the env var is only whitespace THEN there is no key", () => {
		expect(source({ env: { [OPENAI_API_KEY_ENV_VAR]: "  " } }).apiKey()).toBeNull();
	});

	it("WHEN no secret is chosen THEN the secret store is not asked", () => {
		const secrets = new FakeSecrets({});
		new SecretOrEnvApiKeySource(secrets, () => "", () => undefined).apiKey();
		expect(secrets.asked).toEqual([]);
	});

	it("WHEN the chosen secret changes between calls THEN the next call reads the new one", () => {
		let chosen = "first";
		const keys = new SecretOrEnvApiKeySource(new FakeSecrets({ first: "sk-1", second: "sk-2" }), () => chosen, () => undefined);
		keys.apiKey();
		chosen = "second";
		expect(keys.apiKey()).toBe("sk-2");
	});
});
