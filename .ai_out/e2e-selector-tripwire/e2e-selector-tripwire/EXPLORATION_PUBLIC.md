# Exploration: e2e `.vicinity-graph-*` selector tripwire

Task context (not implemented here): add a cheap vitest test running inside
`npm test` that fails when a `.vicinity-graph-*` CSS class asserted in
`e2e/**/*.e2e.ts` doesn't exist anywhere in `src/view/**` (`*.tsx`/`*.ts`
render code or `*.css`). Absence assertions (`toHaveCount(0)`) are exempt.

## a. Verification of prior-explorer facts 1-4

1. **CONFIRMED, with one addition.** `e2e/vicinityGraph.e2e.ts:178`:
   ```ts
   await expect(page.locator(".vicinity-graph-node__breadcrumb")).toHaveCount(0);
   ```
   `.vicinity-graph-node__breadcrumb` exists nowhere under `src/view/**`
   (verified: `grep -rhoE 'vicinity-graph-[A-Za-z0-9_-]+' src/view --include=*.tsx --include=*.ts --include=*.css | sort -u` — 76 distinct tokens, this one absent). It is the ONLY `.vicinity-graph-*` token used anywhere in `e2e/**/*.ts` that is absent from `src/view/**`, once class names are compared without the leading `.` (see point 3 correction below) — i.e. after excluding it, a correct scanner has ZERO other false positives on the current codebase. Other absence-assertion line numbers from the prior explorer are confirmed present: `e2e/vicinityGraph.e2e.ts:77,88,110,133,137,153`; `e2e/nodeOutline.e2e.ts:114,274` (not independently re-verified line-by-line here, but the same `toHaveCount(0)` grep pattern holds); `e2e/pinnedCentralScenario.e2e.ts:126,132,148,165`; `e2e/settingsResetReview.e2e.ts:162`; `e2e/settingsResetVerify.e2e.ts:64`; `e2e/settingsUxVisual.e2e.ts:257`.

2. **CONFIRMED.** Compound selectors mixing owned/unowned tokens exist, e.g. `e2e/edgeRoutingEval.e2e.ts:29` and `e2e/edgeRouting.e2e.ts:53`:
   ```ts
   const EDGE_PATH_SELECTOR = ".vicinity-graph-flow .react-flow__edge-path";
   ```
   Also `e2e/settingsUxVisual.e2e.ts:474`: `.vicinity-graph-settings .setting-item`. A token-extraction regex `/\.vicinity-graph-[\w-]+/g` applied to the raw selector string correctly pulls just the owned token(s) out of these. **No case of the `vicinity-graph-` prefix itself being interpolated was found** (checked via `grep -n 'vicinity-graph-\${' e2e` — zero hits), so a static regex scan is safe; only *suffixes/attribute values* after a literal `vicinity-graph-` prefix are ever interpolated (see point b).

3. **CONFIRMED, with an important nuance for the extraction/matching logic.** `src/view/**` produces `.vicinity-graph-*` classes as plain string literals only — confirmed across `.tsx` (`className="..."`) and, additionally to the prior explorer's finding, in **`.ts`** files too: `src/view/VicinityGraphSettingTab.ts` uses Obsidian's `createDiv({ cls: "vicinity-graph-settings-section" })`, `createEl(..., { cls: "vicinity-graph-settings-advanced" })`, etc. (lines 141, 190, 220, 409, 417, 426). **`Disclosure.tsx:29,31`** only appends caller-supplied extra classes after a literal base — confirmed, no dynamic prefix concatenation anywhere in `src/view`.
   **Nuance:** doing a naive dot-prefixed regex (`/\.vicinity-graph-[\w-]+/`) against `src/view/**` source text will UNDER-match, because `className="vicinity-graph-attachment"` and Obsidian's `cls: "vicinity-graph-sizing"` never carry a leading dot in the source — only CSS selector rules (`.vicinity-graph-attachment { ... }` in `.css` files) do. The correct approach (verified by rerunning the comparison both ways) is:
   - Extract e2e tokens with the dot (`/\.vicinity-graph-[\w-]+/g`) since that's how they appear in selector strings, then **strip the leading dot**.
   - Extract src tokens **without** requiring a leading dot (`/vicinity-graph-[\w-]+/g`) across `.tsx`, `.ts`, and `.css` under `src/view/**`, since `className`/`cls` string literals have no dot but CSS rules do.
   - Compare the two token sets as bare strings (no dot) — this produces exactly one false-positive-looking mismatch, `vicinity-graph-node__breadcrumb`, which is the known/exempt absence assertion. Comparing WITH the dot required on both sides produces THREE spurious "missing" results (`vicinity-graph-attachment__count`, `vicinity-graph-sizing`, plus the real one) purely due to this dot-stripping artifact, not because those classes are actually missing — they ARE present, e.g. `src/view/NoteNode.tsx:186` (`className="vicinity-graph-attachment__count"`) and `src/view/SizingSection.tsx:41` (`className="vicinity-graph-sizing"`).

4. **CONFIRMED.** `vitest.config.ts` (repo root):
   ```ts
   include: ["src/**/*.test.{ts,tsx}", "e2e/**/*.test.ts"],
   ```
   with an explanatory comment: `e2e/**/*.test.ts` = pure unit tests for e2e HELPERS (no Obsidian, no browser); Playwright only picks up `*.e2e.ts`, so the two never overlap. A new `e2e/*.test.ts` file runs under `npm test`.

## b. Full inventory of syntactic forms of `.vicinity-graph-*` in `e2e/**/*.e2e.ts`

- **Plain string literal to `page.locator()`:** `e2e/vicinityGraph.e2e.ts:72` `page.locator(".vicinity-graph-node")`.
- **Template literal with `${}` interpolation of an ATTRIBUTE VALUE (not the class name):** `e2e/vicinityGraph.e2e.ts:62` `` page.locator(`.vicinity-graph-node[data-path="${path}"]`) ``; also `nodeOutline.e2e.ts:84`, `pinnedCentralScenario.e2e.ts:59,63`, `controlsRestart.e2e.ts:60`, `settingsUxVisual.e2e.ts:43`, `edgeRouting.e2e.ts:127,133,231`. In every case the `vicinity-graph-*` token itself is a static prefix; only the bracket predicate value is interpolated — a regex scan is unaffected.
- **Compound descendant selector, single string (owned + unowned tokens):** `e2e/edgeRouting.e2e.ts:53` / `edgeRoutingEval.e2e.ts:29`: `const EDGE_PATH_SELECTOR = ".vicinity-graph-flow .react-flow__edge-path";`; `e2e/obsidianHarness.ts:280`: `page.locator(".vicinity-graph-flow, .vicinity-graph-empty")` (comma-separated alternation, TWO owned tokens).
- **Chained/tag+class selector:** `e2e/vicinityGraph.e2e.ts:92` `page.locator("button.vicinity-graph-attachment")`; `nodeOutline.e2e.ts:92` `"button.vicinity-graph-outline__entry"`; `settingsUxVisual.e2e.ts:157` `"details.vicinity-graph-forcelayout__advanced"`.
- **`.locator()` with Playwright's `{ hasText }` option (second-arg object, not a selector string):** `e2e/pinnedCentralScenario.e2e.ts:94-95`:
  ```ts
  return page.locator(".vicinity-graph-disclosure", {
      has: page.locator(".vicinity-graph-disclosure__summary", { hasText: "Pinned centrals" }),
  });
  ```
  Also `settingsUxVisual.e2e.ts:55-56`, `controlsRestart.e2e.ts:79-80`, and `settingsTabPage.ts:57` (`{ hasText: headingText }` — `headingText` here IS a variable, but it's the TEXT filter, not the class selector).
- **`{ has: page.locator(...) }` nested locator (Playwright's `:has()`-equivalent API, not CSS `:has()` syntax):** `pinnedCentralScenario.e2e.ts:94-95` above — no literal `:has(...)` CSS pseudo-class string was found anywhere in `e2e/**`.
- **Direct-child combinator chain, single string with MULTIPLE owned tokens:** `e2e/settingsUxVisual.e2e.ts:101`: `.locator(".vicinity-graph-toolbar__body > .vicinity-graph-disclosure > .vicinity-graph-disclosure__summary")`.
- **Descendant selector, single string with MULTIPLE owned tokens (space-separated):** `e2e/settingsUxVisual.e2e.ts:205` `".vicinity-graph-settings-section .vicinity-graph-settings-reset"`, `:354` `".vicinity-graph-settings .vicinity-graph-segmented"`.
- **Mixed owned + Obsidian-native token:** `e2e/settingsUxVisual.e2e.ts:474` `".vicinity-graph-settings .setting-item"`.
- **`page.evaluate` / DOM `document.querySelector(All)` (not Playwright locator API) with template literals:** `e2e/edgeRouting.e2e.ts:127,133,177`; `e2e/settingsResetReview.e2e.ts:256-258` including `:scope > .vicinity-graph-settings-section`.
- **Chained `.locator().locator()` across statements:** `e2e/pinnedCentralScenario.e2e.ts:69-71`, `controlsRestart.e2e.ts:69-71` — `.locator(".vicinity-graph-stepper").locator(".vicinity-graph-stepper__value")`.
- **`toHaveAttribute`/`toContainText`/`toBeVisible` assertions on a class-selected locator (non-count assertions, all presence-style — must NOT be exempt):** `pinnedCentralScenario.e2e.ts:175,179` `toHaveAttribute`; `settingsUxVisual.e2e.ts:136,144` `toContainText`/`toHaveCount(2)`; `externalVault.e2e.ts:55` `toBeVisible`.
- **No `getByTestId`/`data-testid` usage found anywhere in `e2e/**`** (`grep -rn "getByTestId\|data-testid" e2e` → zero hits) — the plugin does not use test IDs; all targeting is via `.vicinity-graph-*` classes.
- **No case of the `vicinity-graph-` token itself being built via `${}` interpolation** (would defeat a static regex scan) — confirmed via `grep -n 'vicinity-graph-\${' e2e` → zero hits. Every interpolation inside a `.vicinity-graph-*`-bearing selector string targets an attribute VALUE or unrelated substring, never the class token.
- **Helper files that centralize selectors (IMPORTANT — these are `.ts`, not `.e2e.ts`):**
  - `e2e/obsidianHarness.ts:280` — `.vicinity-graph-flow, .vicinity-graph-empty` inside a harness method (`waitForGraphSettled`-style) called from multiple `*.e2e.ts` files.
  - `e2e/settingsTabPage.ts:38,57,62,67` — a Page-Object class (`SettingsTabPage`) wrapping `.vicinity-graph-settings-section`, `.vicinity-graph-settings-reset`, `.vicinity-graph-settings-reset-all`, used by `settingsResetReview.e2e.ts`/`settingsResetVerify.e2e.ts`/`settingsUxVisual.e2e.ts`.
  - `e2e/settingsBaseline.ts:85,90,106` — doc-comments referencing `.vicinity-graph-disclosure__summary`, `.vicinity-graph-disclosure`, `.vicinity-graph-toolbar__body` (comments only in this file, no live selector strings there — the live strings for these classes are in the `*.e2e.ts` files themselves, e.g. `pinnedCentralScenario.e2e.ts:94-95`).
  - **Scope implication:** if the new test's glob is literally `e2e/**/*.e2e.ts` (matching the task's stated scope), `obsidianHarness.ts` and `settingsTabPage.ts` selector literals are NOT scanned directly — but every class they reference also appears redundantly, in this codebase, in at least one `*.e2e.ts` file (verified: `.vicinity-graph-flow`/`.vicinity-graph-empty` also appear in `externalVault.e2e.ts:54-55`/`edgeRouting.e2e.ts:213`; `.vicinity-graph-settings-section`/`.vicinity-graph-settings-reset*` also appear in `settingsUxVisual.e2e.ts:184,205,243`). So restricting the glob to `*.e2e.ts` only does not currently lose coverage, but it is a latent gap: a NEW class introduced only in a helper file's selector (never repeated in an `*.e2e.ts` file) would silently escape the tripwire. This is a fact for the implementer/reviewer to weigh, not a design decision made here.

## c. Exact textual shape of absence assertions

Representative code, `e2e/vicinityGraph.e2e.ts:170-185` (comment trimmed for space, see file for full rationale block):
```ts
test("no node renders a folder-prefix breadcrumb", async () => {
	await expect(page.locator(".vicinity-graph-node__breadcrumb")).toHaveCount(0);
});
```
**Shape: same-statement, same-line.** The locator call and `.toHaveCount(0)` are one chained expression: `expect(page.locator(SELECTOR)).toHaveCount(0)` — SELECTOR appears as a literal argument to `.locator(...)` directly inside the same `expect(...)` chain, all on one line/statement. This is the DOMINANT shape. Other examples, same shape:
- `e2e/vicinityGraph.e2e.ts:77`: `await expect(page.locator('.vicinity-graph-node[data-tier="pinned-central"]')).toHaveCount(0);`
- `e2e/vicinityGraph.e2e.ts:88`: `await expect(folderGroup("projects").locator(".vicinity-graph-group__badge")).toHaveCount(0);` — here the receiver is a HELPER FUNCTION CALL (`folderGroup(...)`) rather than `page`, but the selector text `.vicinity-graph-group__badge` (the class actually being asserted absent) is still a literal argument to `.locator(...)` on the same line as `toHaveCount(0)`.
- `e2e/settingsUxVisual.e2e.ts:257` (per prior explorer, pattern consistent): same `expect(page.locator(...)).toHaveCount(0)` one-liner shape.
**No example was found of a DIFFERENT shape** (e.g., a locator stored in an intermediate variable on one statement/line and asserted with `toHaveCount(0)` on a later, separate statement/line). Every `.toHaveCount(0)` in the codebase is directly chained onto an `expect(<locator-expression>)` in the same statement. This means a **line-level (or same-statement) text check is sufficient** — the exemption rule can be "does this line/statement contain both a `.vicinity-graph-*` token and a `toHaveCount(0)` call" without needing cross-statement/variable-flow analysis. (Caveat: `folderGroup("projects").locator(...)` at line 88 means the exemption logic must look at the classes appearing anywhere in the statement's locator CHAIN, not just the first `.locator()` call — `folderGroup` itself contains `.vicinity-graph-group` (not `__badge`), so the specific absent-asserted class is the one in the outermost `.locator(...)` call, still on the same line.)

## d. Full inventory of `.vicinity-graph-*` class producers under `src/view/**`

Files containing `vicinity-graph-` tokens (`.tsx`, `.ts`, `.css`):
```
src/view/CentralDepthControls.tsx  src/view/FolderGroupNode.tsx    src/view/NodeOutline.tsx
src/view/DepthStepper.tsx          src/view/ForceLayoutSection.tsx src/view/NoteNode.tsx
src/view/Disclosure.tsx            src/view/GraphToolbar.tsx       src/view/SizingSection.tsx
src/view/NodeContentsSection.tsx   src/view/ToggleSwitch.tsx       src/view/VicinityEdge.tsx
src/view/NodeExclusionSection.tsx  src/view/VicinityGraphFlow.tsx  src/view/VicinityGraphView.tsx
src/view/VicinityGraphSettingTab.ts (a .ts file, uses Obsidian's `{ cls: "..." }`, not JSX)
src/view/graph-view.css  src/view/node-outline.css  src/view/segmented-control.css  src/view/settings-tab.css
```
Total distinct `vicinity-graph-*` tokens across these files (bare, no dot): **76** (`grep -rhoE 'vicinity-graph-[A-Za-z0-9_-]+' src/view --include=*.tsx --include=*.ts --include=*.css | sort -u | wc -l`).
No CSS-only-never-rendered or rendered-only-never-styled class was found among the tokens actually asserted in e2e — the one CSS-vs-JSX mismatch case (`vicinity-graph-attachment__count`) turned out to be a false alarm from the dot-stripping bug described in point 3, not a real producer gap. (A full CSS-vs-JSX symmetry audit of all 76 tokens was NOT performed — out of scope; only the ~39 tokens actually referenced from `e2e/**` were cross-checked against `src/view/**`.)

## e. Structure/style of prior-art scan tests

**`e2e/vaultTarget.test.ts`** (describe block `"e2e harness destructive calls"`, near end of file):
- Uses `fs.readdirSync(path.join(REPO_ROOT, "e2e")).filter((name) => name.endsWith(".ts") && name !== path.basename(import.meta.url))` — i.e. **plain `fs.readdirSync`, NOT glob/fast-glob**, filtered by string suffix, with explicit self-exclusion.
- Reads each file with `fs.readFileSync(path.join(REPO_ROOT, "e2e", name), "utf8")` and regex-scans the raw text (`mutatingDestinations`, a hand-rolled matcher using `matchAll` + a small `topLevelArguments` paren/comma parser).
- BDD `describe`/`it("WHEN ... THEN ...")` naming throughout.
- Assertion style: build an `offenders` array via `.flatMap(...).filter(...)`, then `expect(offenders).toEqual([])` — reports WHICH lines/files failed rather than a boolean, so failures are self-diagnosing.
- Includes a **meta-test proving the scanner itself works**: `it("WHEN scanning a harness that wrote to an arbitrary path THEN the scan reports it", ...)` feeds a synthetic string directly to the matcher function.
- REPO_ROOT resolved via `path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")`.

**`src/engine/importGuard.test.ts`**:
- Uses **`readdirSync(dir, { withFileTypes: true, recursive: true })`** (Node's native recursive readdir, still no glob library) filtered by `.name.endsWith(".ts"/".tsx")`, mapped to full paths via `join(entry.parentPath, entry.name)`.
- Regex array (`MODULE_SPECIFIER_PATTERNS`) applied via `matchAll` across raw file text; forbidden-prefix check via `.some((prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`))`.
- BDD naming (`describe("engine import guard", ...)`, `it("WHEN scanning ... THEN ...")`).
- Assertion style: `offenders` array (`{file, forbidden}` pairs) then `expect(offenders).toEqual([])`.
- Has a **separate `describe("... matcher")` block** that unit-tests the regex/extraction function itself against synthetic template-literal snippets (a `q()` helper quotes strings so the guard's OWN source doesn't self-trip) — directly analogous to what a selector-extraction unit test would need for e2e selector strings.
- No glob/fast-glob dependency anywhere in either file — **plain `node:fs` (`readdirSync`/`readFileSync`) is the established repo convention** for this kind of static source scan.

## f. e2e typechecking scope

- `package.json:13-14`: `"check": "tsc -noEmit && npm run check:e2e"`, `"check:e2e": "tsc -noEmit -p e2e/tsconfig.json"`.
- `e2e/tsconfig.json`: `{ "extends": "../tsconfig.json", "compilerOptions": { "types": ["node"] }, "include": ["./**/*.ts"] }` — comment notes e2e runs under node (Playwright transpiles), no JSX/DOM-global assumptions beyond page.evaluate needs.
- `include: ["./**/*.ts"]` is a glob over ALL `.ts` under `e2e/`, so a new `e2e/*.test.ts` file **is** included in `check:e2e` (and thus `npm run check`/`npm run build`) automatically — no config change needed for typechecking. It is picked up for `npm test` execution via `vitest.config.ts`'s `"e2e/**/*.test.ts"` include (fact 4), and for typechecking via this `e2e/tsconfig.json` include — the two config surfaces are independent but both already cover the new file's name pattern without edits.
