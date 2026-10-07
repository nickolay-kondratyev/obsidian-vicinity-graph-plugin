import type { AiNamingFailure } from "../engine";

/**
 * WHAT THE USER IS TOLD when AI naming fails (task 3/4
 * `nid_cbnhpdfn4myqfzqr8weyg7kq5_e`; shown by task 4/4's status line and its
 * once-per-kind notice): what went wrong and how to fix it, in plain words —
 * never a raw status code. A `Record` over {@link AiNamingFailure}, so a new
 * failure kind is a compile error here until it has copy.
 */
const AI_NAMING_FAILURE_COPY: Readonly<Record<AiNamingFailure, string>> = {
	"no-key":
		"AI naming needs an OpenAI API key. Pick a key in the plugin settings, or start Obsidian from a terminal with " +
		"OPENAI_API_KEY set — apps started from the desktop don't see shell variables.",
	"bad-key": "OpenAI refused the API key. Check that the key in the plugin settings (or OPENAI_API_KEY) is correct and active.",
	"unknown-model":
		"OpenAI doesn't offer the chosen model to this key. Check the model name in the plugin settings.",
	"rate-limited": "OpenAI is rate-limiting requests right now. Names will continue on a later redraw.",
	"quota-exhausted": "Your OpenAI account is out of credit. Add credit in your OpenAI billing settings, then turn AI naming on again.",
	"rejected-request":
		"OpenAI rejected the naming request. Check the model and reasoning effort in the plugin settings — the model may not support that effort.",
	"server-error": "OpenAI had a problem on its side. Names will continue on a later redraw.",
	network: "Couldn't reach OpenAI. Check your internet connection; names will continue on a later redraw.",
	"unexpected-response": "OpenAI sent an answer the plugin couldn't read. Names will continue on a later redraw.",
};

export function aiNamingFailureCopy(failure: AiNamingFailure): string {
	return AI_NAMING_FAILURE_COPY[failure];
}
