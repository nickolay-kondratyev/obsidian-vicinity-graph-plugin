/**
 * What a markdown renderer SHOWS for text a module escaped for it: the backslash
 * escapes are renderer plumbing (see `MarkdownEmbeds`'s `ASCII_PUNCTUATION`), so
 * a naming assertion reads the text a user would see rather than the plumbing.
 *
 * Test-only, and SHARED because it is one piece of knowledge ("the marker is
 * backslash-escaped") that both the unit suite and the adapter suite would
 * otherwise each re-state. The escaping ITSELF is asserted verbatim, once, in
 * `MarkdownEmbeds.test.ts`.
 */
export function asRendered(markdown: string | undefined): string | undefined {
	// `undefined` travels through: a caller reading an OPTIONAL snippet then fails
	// its assertion against the missing value, not against a substituted "".
	return markdown?.replace(/\\(.)/g, "$1");
}
