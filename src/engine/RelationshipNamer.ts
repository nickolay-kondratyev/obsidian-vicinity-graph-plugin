import type { RelationshipName } from "./RelationshipName";
import type { RelationshipPrompt } from "./RelationshipPrompt";

/**
 * The AI relationship namer (epic `nid_fc47gtxej6z7fqc53bflme8p5_e`, task 3/4
 * `nid_cbnhpdfn4myqfzqr8weyg7kq5_e`): one request names ONE directed edge. An
 * engine-defined port because naming is network I/O; implemented by
 * `adapters/OpenAiRelationshipNamer.ts`, faked by {@link FakeRelationshipNamer}.
 */

/** The model auto mode asks by default (human decision 2026-10-06; ~$0.10 / $0.50 per 1M input/output tokens). */
export const DEFAULT_AI_MODEL = "gpt-6-luna";

/**
 * Every reasoning effort the `gpt-6-luna` model page lists, lowest first.
 * WHY `xhigh` / `max` are here although UNVERIFIED: the generic API reference
 * lists only low/medium/high, and no live call has confirmed the other two yet
 * (no key in the dev environment, task 3/4). Verify both with one live call
 * before task 4/4 OFFERS them in the UI; a model that rejects one answers 400,
 * which maps to the fatal `rejected-request` failure, so a wrong guess stops
 * auto mode instead of hammering.
 */
export const AI_REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"] as const;

export type AiReasoningEffort = (typeof AI_REASONING_EFFORTS)[number];

/** Default effort (human decision 2026-10-06): enough thought to pick a SPECIFIC name, cheap enough per edge. */
export const DEFAULT_AI_REASONING_EFFORT: AiReasoningEffort = "medium";

/** Which model, at which effort — read from settings at submit time (task 4/4), recorded with every AI name. */
export interface AiNamingConfig {
	readonly model: string;
	readonly effort: AiReasoningEffort;
}

/** Token counts one naming request used — kept so the cost of auto mode stays visible. */
export interface RelationshipTokenUsage {
	readonly inputTokens: number;
	readonly outputTokens: number;
}

/** What an AI name is stored with: the name plus the model / effort / usage that produced it. */
export interface AiNamedRelationship {
	readonly name: RelationshipName;
	readonly model: string;
	readonly effort: AiReasoningEffort;
	/** `null` when the provider reported no usage — never invented as zero. */
	readonly usage: RelationshipTokenUsage | null;
}

/**
 * Why a request did not come back with a name, in the USER's terms (the view
 * owns the copy). Mapped from transport facts by the adapter; see
 * {@link isFatalAiNamingFailure} for which ones stop auto mode.
 */
export type AiNamingFailure =
	/** No key in the chosen secret and no `OPENAI_API_KEY` in the environment. */
	| "no-key"
	/** 401: the key was refused. */
	| "bad-key"
	/** 403 / 404: the model slug is unknown or not available to this key. */
	| "unknown-model"
	/** 429 (rate): too many requests right now; a later redraw may succeed. */
	| "rate-limited"
	/** 429 `insufficient_quota`: the account is out of credit; nothing later this session will succeed. */
	| "quota-exhausted"
	/** Any other 4xx: the request itself is wrong (e.g. an effort the model does not accept). */
	| "rejected-request"
	/** 5xx: OpenAI's side failed; a later redraw may succeed. */
	| "server-error"
	/** The request never got an HTTP answer (offline, DNS, TLS). */
	| "network"
	/** An HTTP 200 whose body is not the Responses shape we asked for. */
	| "unexpected-response";

/**
 * Failures that would fail EVERY following request the same way — auto mode
 * stops on these instead of hammering (task 3/4). The rest are per-request or
 * transient.
 */
const FATAL_AI_NAMING_FAILURES: ReadonlySet<AiNamingFailure> = new Set<AiNamingFailure>([
	"no-key",
	"bad-key",
	"unknown-model",
	"quota-exhausted",
	"rejected-request",
]);

export function isFatalAiNamingFailure(failure: AiNamingFailure): boolean {
	return FATAL_AI_NAMING_FAILURES.has(failure);
}

/**
 * Why THIS pair gets no name, though nothing is wrong with the setup: the model
 * refused, answered something that is not a valid name, or (400
 * `context_length_exceeded`) the two notes are too big for it. Asking again would
 * answer the same, so a declined pair is not retried this session.
 */
export type AiNamingDecline = "refusal" | "invalid-name" | "notes-too-long";

export type RelationshipNamingOutcome =
	| { readonly kind: "named"; readonly name: RelationshipName; readonly usage: RelationshipTokenUsage | null }
	| { readonly kind: "declined"; readonly reason: AiNamingDecline; readonly usage: RelationshipTokenUsage | null }
	| { readonly kind: "failed"; readonly failure: AiNamingFailure };

export interface RelationshipNamingRequest {
	readonly prompt: RelationshipPrompt;
	readonly config: AiNamingConfig;
}

export interface RelationshipNamer {
	/** Names one directed edge. NEVER rejects: every failure comes back as a `failed` outcome. */
	nameRelationship(request: RelationshipNamingRequest): Promise<RelationshipNamingOutcome>;
}
