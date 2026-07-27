# Exploration: test surface for "Settings tab: debounce numeric/text writes and validate bounds"

Repo root: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin`
Branch: `settings-debounce-validation` (currently identical to `main` for all files inspected — only
`.ai_out/settings-debounce-validation/TOP_LEVEL_AGENT.md` differs, per `git diff main..HEAD --stat`).

## 1. How `VicinityGraphSettingTab.ts` is (not) tested today

**There is no direct unit test file for `src/view/VicinityGraphSettingTab.ts` itself** — no
`VicinityGraphSettingTab.test.ts` exists, and nothing mounts the class in vitest/JSDOM. Grep
confirms: `find … -iname "*settingtab*test*"` returns nothing.

Instead, the tab is tested by testing the **pure logic it calls into**, colocated in `src/view/`:

- `src/view/settingsWritePlan.ts` / `.test.ts` (139 lines of tests) — pins `planSettingsWrite`,
  the ONE function that turns a `SettingsInteraction` into a `SettingsCommand`. E.g.
  `settingsWritePlan.test.ts:1-80` covers `main-depth`, `central-depth`, `global-depth`,
  `global-cap`, `global-sizing` (including an out-of-range-input-gets-clamped case around line 74).
  This is where a new "reject maxPx < minPx" rule would plug in, or in `clampSizingSettings` itself
  (`src/engine/constants.ts:157-173`, tested via `src/engine/SettingsSpec.test.ts` and
  presumably `constants.test.ts`/`NodeSizer.test.ts`).
- `src/view/settingsResetPlan.ts` / `.test.ts` — pins `planSettingsReset` / confirmation copy per
  scope (`docs-internal` cards ↔ `SETTINGS_RESET_SCOPES`).
- `src/view/settingsWriteScope.ts` / `.test.ts` — a third pure helper in the same family (worth
  reading if debounce needs a "which write belongs to which control" concept).
- `src/engine/SettingsSpec.ts` / `.test.ts` — pins the **entire spec** (defaults + bounds) as an
  exhaustive baseline via `satisfies EverySpecField<...>` / `SpecLimitsBaseline<...>` marker types
  (`SettingsSpec.test.ts:33-52`), so adding a bound (e.g. tightening `maxPx >= minPx`) must update a
  baseline object here or `tsc` (not just vitest) goes red.

**None of these ever import `obsidian` or instantiate `PluginSettingTab`/`Setting`.** They test the
tab's *behavior contract* as plain data-in/data-out functions, never the DOM the tab renders. This
is a deliberate layering choice (`VicinityGraphSettingTab.ts:40-51`, and CLAUDE.md's `view → adapters
→ engine` rule) — Obsidian glue is kept "thin" and the pure planners hold all the logic worth unit
testing.

**Boilerplate a new pure-logic test would copy** (from `settingsWritePlan.test.ts:1-9`):
```ts
import { describe, expect, it } from "vitest";
import { EngineDefaults, SIZING_RANGES } from "../engine";
import type { SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";

const CTX: SettingsWriteContext = {
	globalDepths: { outgoingDepth: 1, incomingDepth: 1 },
	globalView: EngineDefaults.viewSettings(),
	nodeExclusion: EngineDefaults.nodeExclusionSettings(),
};
```
No fakes, no obsidian mock needed — `planSettingsWrite`/`clampSizingSettings` are pure functions of
plain data.

## 2. No DOM/JSDOM harness for Obsidian `Setting` exists in unit tests

- `package.json:36` pins `"obsidian": "latest"` — this is the **real** `obsidian` npm package,
  which ships **types only** (`obsidian.d.ts`), no runtime implementation. It cannot be
  instantiated in Node/vitest.
- There is no `__mocks__/obsidian.ts`, no vitest alias, and no fake `Setting`/`PluginSettingTab`
  anywhere under `src/` or root config. `grep -rn "obsidian" vitest.config.*` is empty.
- Consequently **nothing in `npm test` ever mounts `VicinityGraphSettingTab`, `Setting`,
  `addText`, `addSlider`, `addTextArea`, or `PluginSettingTab`.** The only place that DOM exists is
  the real Electron/Obsidian instance driven by Playwright in `e2e/*.e2e.ts` (see §5) — there is no
  in-between JSDOM-mocked-Obsidian layer.
- Practical implication for this ticket: a debounce/validation test that needs to touch the actual
  `Setting`/text-input DOM must either (a) stay at the `e2e/*.e2e.ts` level (real Obsidian,
  Playwright), or (b) extract the debounce/validation policy into another pure function
  (`src/view/*.ts`, no obsidian import) and unit-test THAT, mirroring how `planSettingsWrite`,
  `parseSizingInput` (`src/view/sizingInput.ts`) and `parseExclusionPatterns`
  (`VicinityGraphSettingTab.ts:87-92`, currently private/inline — would need extracting) already
  separate "what to do with typed input" from the obsidian glue. Given the existing convention,
  (b) is almost certainly the intended path — e.g. a `settingsDebouncePlan.ts` or extending
  `sizingInput.ts` — with only a thin `e2e` smoke test at the Obsidian layer.

`vitest.config.ts:1-9` confirms scope: `include: ["src/**/*.test.{ts,tsx}", "e2e/**/*.test.ts"]` —
`e2e/**/*.test.ts` are unit tests for e2e **helpers** (no browser, no Obsidian); actual Obsidian
Playwright specs are `*.e2e.ts` and run only via `npm run test:e2e` / `scripts/run-e2e.sh`.

## 3. Fake-timer usage for debounce (existing pattern to copy)

`src/view/GraphViewController.test.ts:789-871` is the **one existing debounce test suite** in the
repo and is the direct template for the new numeric/text debounce tests. Key mechanics:

```ts
describe("GraphViewController metadata-resolve debounce", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		vi.stubGlobal("window", globalThis);   // controller debounces via window.setTimeout;
	});                                          // node test env has no `window`
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});
	...
	vi.advanceTimersByTime(REBUILD_DEBOUNCE_MS - 100); // < window: not fired yet
	vi.advanceTimersByTime(REBUILD_DEBOUNCE_MS);       // window elapses: fires once
});
```
- Only `setTimeout`/`clearTimeout` are faked (`toFake: [...]`) — `flush()`'s `setImmediate` (line
  49-51: `new Promise((resolve) => setImmediate(resolve))`) stays real so async continuations still
  drain, a pattern worth reusing verbatim for any async persist-after-debounce assertion.
- `REBUILD_DEBOUNCE_MS = 500` lives in `src/view/constants.ts:26` and is the only existing debounce
  constant; a new settings-tab debounce constant should sit beside it (or be a new named constant —
  ticket does not currently specify a shared value, worth flagging to the human).
- This is the ONLY `vi.useFakeTimers` call in the repo (`grep -rln "useFakeTimers" src e2e` →
  exactly this one file). No other precedent to reconcile.
- The debounce is currently implemented directly inside `GraphViewController` via
  `this.debounceTimer = window.setTimeout(...)` (`GraphViewController.ts:170-176`, cancel path
  `:387-389`) — i.e. **hand-rolled per call site, not a shared debounce utility**. A settings-tab
  debounce will likely need its own hand-rolled `window.setTimeout`/`clearTimeout` pair (same
  `window` shim trick) unless a shared debounce helper is extracted first (worth a DRY note if the
  same pattern is about to appear a second time).

## 4. BDD / one-assert conventions

Two representative snippets (both already read above):

```ts
// src/view/settingsWritePlan.test.ts:13
it("WHEN main-depth outgoing value 3 THEN a doc-depth-field write targets outgoingDepth", () => {
	expect(planSettingsWrite({ kind: "main-depth", direction: "outgoing", value: 3 }, CTX)).toEqual({
		kind: "doc-depth-field",
		field: "outgoingDepth",
		value: 3,
	});
});
```
```ts
// src/view/GraphViewController.test.ts:821
it("WHEN resolve events fire repeatedly within the window THEN no rebuild has fired yet (coalesced)", async () => {
	const h = setup();
	await withMain(h);
	burstWithinWindow(h, 5);
	expect(h.source.calls).toEqual(["a.md"]); // only the initial build; burst still pending
});
```
Every test file is colocated `*.test.ts` next to its subject, named `WHEN … THEN …`, one behavior
(usually one `expect`) per `it`.

## 5. e2e/ coverage of the settings tab — debounce race risk

Relevant files: `e2e/settingsTabPage.ts` (page object), `e2e/settingsBaseline.ts` (data-driven
card/scope tables, no `fs`/no obsidian import — pure), `e2e/settingsResetReview.e2e.ts`,
`e2e/settingsResetVerify.e2e.ts`, `e2e/settingsUxVisual.e2e.ts`, `e2e/settingsBaseline.test.ts`
(node-side unit test for `settingsBaseline.ts`'s own data, not a browser test).

**No existing e2e spec types into a settings-tab text/number input and then asserts on it.**
Checked explicitly: `grep -rn "\.fill(\|\.type(" e2e` → zero hits anywhere in `e2e/`. Every place
that changes a numeric/text setting in these specs goes through
`harness.saveGlobalView(...)`/`harness.saveGlobalDepths(...)`/`harness.saveNodeExclusion(...)`
(a persistence-layer harness call bypassing the UI entirely, e.g.
`e2e/settingsResetReview.e2e.ts:37-51` `dirtyEverySection()`), followed by `settingsTab.redisplay()`
to re-render, then a `toHaveValue(...)` assertion on the rendered DOM
(`e2e/settingsResetReview.e2e.ts:151-154`, `:243`, `:250`). So **these specs read a value the tab
rendered from the store; they never simulate a keystroke into the tab's own input and then race a
persisted read.**

The only place any input is driven programmatically is `settingsUxVisual.e2e.ts:191`:
```ts
input.dispatchEvent(new Event("input", { bubbles: true }));
```
— dispatched on a `range` slider inside `page.evaluate`, to trigger Obsidian's `Setting.addSlider`
`onChange` for a visual check, not followed by any persisted-value assertion in that spot (checked
surrounding context at `:179-191`; it is about counting/inspecting sliders, not write correctness).
`e2e/settingsUxVisual.e2e.ts:494-496` also only locates a slider input by `aria-label`, again no
`.fill()`.

**Conclusion for the ticket:** introducing a debounce on numeric/text settings inputs should NOT
break any current e2e assertion, because none currently drives a keystroke-then-immediate-read race
through the real `<input>` elements — but this is a coverage GAP, not a guarantee: the ticket's new
debounce tests will be the FIRST to actually type into these inputs, so any real Obsidian e2e test
added for this ticket (if any) must account for the debounce window itself (e.g. wait
`>= debounceMs` before asserting persistence, or use `page.clock`/Playwright fake timers — neither
of which any existing e2e spec currently does; there is no precedent to copy for e2e-side timer
control).

## 6. Existing tests for exclusion-regex handling and clamping/normalization

**Regex/exclusion:**
- `src/engine/PathExclusionMatcher.ts:36-43` — `compile()` wraps `new RegExp(pattern)` in
  `try/catch`, returning `undefined` on failure ("silently skipped … never throws" per the class
  doc at lines 3-14).
- `src/engine/PathExclusionMatcher.test.ts:56` — `"WHEN an invalid pattern sits beside a valid one
  THEN the valid one still matches"` is the ONE existing test that exercises an invalid regex, and
  it only proves the matcher tolerates it silently. **There is no test anywhere (unit or e2e) that
  asserts a user-visible signal for an invalid pattern** — `VicinityGraphSettingTab.addExclusionPatterns`
  (`VicinityGraphSettingTab.ts:261-278`) just parses lines and writes them through, with a `.setDesc(...)`
  string that says "Invalid patterns are ignored" (line 265) but no per-line error UI, no CSS class,
  no aria-invalid. This is the concrete gap ticket item (d) targets — a new
  test (and its subject function, e.g. an exported `isValidExclusionPattern`/`compileForFeedback`
  helper next to `parseExclusionPatterns`) has no home yet.

**Sizing clamping/normalization:**
- `src/engine/constants.ts:157-173` — `clampSizingSettings(settings)` clamps `minPx`, `maxPx`,
  `depthDecayK`, and every metric `weight` independently into `SIZING_RANGES` (from `SETTINGS_SPEC`),
  each via `clampIntoRange(value, range, spec[field].default)`. **It clamps each field to its own
  `[min, max]` independently — it does NOT check `maxPx >= minPx` as a pair.** E.g. `minPx: 300,
  maxPx: 50` both individually satisfy `[1, 400]` and pass through unchanged today; nothing rejects
  or corrects the inversion. This is the concrete gap ticket item (b) targets.
- `src/view/settingsWritePlan.ts:96-101` (`case "global-sizing"`) is the ONE choke point both sizing
  surfaces write through, calling `clampSizingSettings` — confirmed the single place a `maxPx <
  minPx` guard would need to be added (or inside `clampSizingSettings` itself, one level down,
  which is also where `NodeSizer.ts:45` re-clamps before consuming `minPx`/`maxPx` as geometry).
- `src/view/settingsWritePlan.test.ts` (~line 74, `"WHEN global-sizing carries an out-of-range value
  THEN the planned write is clamped"`) is the existing pinned test to extend/mirror when adding a
  `maxPx < minPx` rejection case — same `CTX`/`planSettingsWrite` harness, no new setup needed.
- `src/engine/SettingsSpec.ts:115` (`NODE_SIZE_PX_BOUNDS = { min: 1, max: 400, step: 4 }`, shared by
  both `minPx` and `maxPx`) and `:184` (`depthDecayK: { default: 1, min: 0, max: 10, step: 0.5 }`)
  already carry upper bounds — item (c) of the ticket ("upper bounds … for sizing px and decay-k")
  appears to be **already satisfied** in `SETTINGS_SPEC` as it stands on this branch (also pinned in
  `src/engine/SettingsSpec.test.ts:183-185`). Worth flagging to the human: either (c) is already
  done and the ticket text is stale, or it means something narrower (e.g. a NEW/tighter bound, or
  wiring `maxPx >= minPx` as a cross-field bound INTO the spec rather than just the write-path
  guard) — the exploration did not find a gap matching a literal reading of (c).

## Summary of concrete gaps a new BDD suite should cover

1. **Debounce (a):** no existing mechanism or test for debouncing numeric/text writes in the
   settings tab. Template: `GraphViewController.test.ts:789-871` fake-timer pattern
   (`vi.useFakeTimers({ toFake: ["setTimeout","clearTimeout"] })` + `vi.stubGlobal("window",
   globalThis)`), applied to whatever new debounce mechanism the settings tab gains (currently every
   `text.onChange`/`addSizingNumber`/`addExclusionPatterns` call `void this.applyInteraction(...)`
   synchronously — `VicinityGraphSettingTab.ts:332-341, 446-452, 534-539, 271-277`).
2. **maxPx < minPx rejection (b):** no guard exists in `clampSizingSettings`
   (`src/engine/constants.ts:157-173`) or `planSettingsWrite`'s `global-sizing` case
   (`settingsWritePlan.ts:96-101`). Extend `settingsWritePlan.test.ts`'s existing clamp test block.
3. **Upper bounds in SETTINGS_SPEC (c):** `minPx`/`maxPx` (max 400) and `depthDecayK` (max 10)
   already have upper bounds pinned in `SettingsSpec.ts`/`SettingsSpec.test.ts` — confirm with the
   human what additional bound this item still wants before writing tests against it.
4. **Invalid regex surfaced to user (d):** engine-side tolerance is tested
   (`PathExclusionMatcher.test.ts:56`) but nothing surfaces validity in the UI — no per-line
   indicator, no exported "is this pattern valid" helper next to `parseExclusionPatterns`
   (`VicinityGraphSettingTab.ts:87-92`, currently private and untested directly).

No test file needs an Obsidian/JSDOM harness to exist first — every existing settings test in this
repo (and, by strong repo convention, every likely new one) exercises a pure function in
`src/view/*.ts` or `src/engine/*.ts`; only a genuinely new *rendered-DOM* assertion (e.g. "an invalid
line gets a CSS class") would need Playwright (`e2e/*.e2e.ts`, real Obsidian) since there is no
in-process Obsidian DOM mock anywhere in this codebase.
