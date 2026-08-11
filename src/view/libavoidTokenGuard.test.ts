import esbuild from "esbuild";
import { beforeAll, describe, expect, it } from "vitest";
import { bundleContentOptions } from "../../esbuild.config.mjs";

/**
 * CI-enforced invariant behind ticket `nid_9sf1iftrf914ggxv3jv3r60sw_e`: the SHIPPED
 * `main.js` must contain none of the tokens the Obsidian community-plugin scanner reads
 * as network calls. Those tokens used to live in libavoid-js's WEB build (Emscripten
 * glue); we resolve libavoid-js to its NODE build and inject the embedded wasm as
 * `wasmBinary` so the same offline engine ships without them (see esbuild.config.mjs +
 * src/view/libavoidLoader.ts). The scan is what paints the user-facing "risk" badge, so
 * a runtime false-positive disclosure cannot clear it — only genuine absence can.
 *
 * We BUILD the real production bundle here (write:false) rather than read main.js off
 * disk, because main.js is a gitignored build artifact that could be stale or missing
 * in a fresh checkout. Reusing `bundleContentOptions` means this scans exactly what
 * `npm run build` emits — no drift.
 */

// The scanner flags these as network egress. `fetch(` is matched WITH its paren so the
// bare word `fetch` inside identifiers/strings does not trip it, mirroring the acceptance
// grep in the ticket.
const NETWORK_RISK_TOKENS = ["fetch(", "XMLHttpRequest", "instantiateStreaming"] as const;

let bundle: string;

beforeAll(async () => {
	const result = await esbuild.build({ ...bundleContentOptions(true), write: false, outfile: undefined });
	const output = result.outputFiles?.[0];
	if (output === undefined) {
		throw new Error("production bundle produced no output file to scan");
	}
	bundle = output.text;
}, 60_000);

describe("libavoid network-token guard over the built main.js", () => {
	it("WHEN the production bundle is built THEN it is non-trivially large (guard is not vacuous)", () => {
		// A truncated/empty bundle would pass every token check by accident; the real
		// bundle is ~2.6MB, so any healthy build clears this floor by a wide margin.
		expect(bundle.length).toBeGreaterThan(500_000);
	});

	for (const token of NETWORK_RISK_TOKENS) {
		it(`WHEN the production bundle is scanned THEN it contains no \`${token}\` network token`, () => {
			expect(bundle.includes(token)).toBe(false);
		});
	}
});
