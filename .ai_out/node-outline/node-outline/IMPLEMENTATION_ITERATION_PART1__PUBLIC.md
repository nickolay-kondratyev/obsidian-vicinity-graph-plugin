# IMPLEMENTATION_ITERATION_PART1__PUBLIC — response to the part-1 review

Role: `IMPLEMENTATION_PART1` (iteration). Input:
`IMPLEMENTATION_REVIEW_PART1__PUBLIC.md` (verdict: CHANGES REQUIRED).
Scope unchanged: plan steps **1–5**. Steps 6–10 untouched; no docs/CHANGELOG
edits (step 10 owns those); no `change_log` entry written.

One commit: `8790ddb refactor(outline): address part-1 implementation review (M1 + minors)`.
Tree clean.

## Status

| | |
|---|---|
| `npm run check` | **PASS** (clean) |
| `npm test` | **790 passed / 3 failed** — the same three **pre-existing** failures (`SettingsSpec.test.ts` ×2, `forceLayoutSettings.test.ts` ×1, `collidePaddingPx` 20 vs 50 from `22bd5cb`). Not touched, not re-pinned. |
| `npm run test:e2e` | not run (out of scope) |

Test count moved 787 → 790: **+3** `isMarkdownPath`, **+2** `GraphViewController`,
**−1** unfailable `GraphStructureDiff` case, **−1** redundant `SettingsSpec`
assertion. No assertion was weakened, relaxed, skipped or re-pinned.

---

## Finding-by-finding disposition

### M1 — `ReferenceOrder.orderedLinkTexts` is dead production code → **FIXED**

Deleted. Confirmed the reviewer's grep: after step 2 the only references were its
own definition and its three tests, because `orderedMarkdownReferences` calls
`orderedReferences` directly.

Its three cases now run against `orderedReferences` through a two-line
`linksOf(cache)` projection in the test file, so the assertions stay behavioural
(link order) rather than restating the shape:

- interleaved links + embeds merged by offset — kept
- frontmatter first — kept
- **empty cache → `[]`** — kept, as the review specifically required (it has no
  equivalent among the two offset-oriented cases, and it is now asserted directly
  on `orderedReferences({})`)

**Plan deviation, called out:** `DETAILED_PLANNING__PUBLIC.md` D3 step 1 sketches
both statics. The plan's stated goal there is "a single ordering truth, no second
implementation"; keeping a projection with no caller serves that goal worse than
deleting it, and CLAUDE.md's clean-break rule is explicit. Behaviour unchanged.

### m1 — plan D3's "one resolution pass" did not ship → **FIXED (differently, and better)**

I did **not** take the suggested "resolve once in `getFileMetadata` and pass the
array to both consumers" — see the rejection note below. I fixed the underlying
cost directly instead.

`firstImageOffsetOf` (resolve **every** reference, then `.find` the first image,
then compare offsets) is replaced by:

```ts
private referencesImageAbove(offsetLimit: number, path: string, cache: CachedMetadataPort): boolean
```

which asks the outline rule as it is actually stated ("is there an image before
the first heading?") and **stops at the limit**: `orderedReferences` is ascending
by offset end to end (frontmatter sentinel `-1`, then body offsets `>= 0`), so
nothing past the first heading can qualify. Consequences:

- The second pass is no longer a full pass. It resolves only the references
  **above the first heading** — for the common note (heading at/near the top)
  that is zero or one `getFirstLinkpathDest` call, not one per reference.
- The eager-resolve-before-`.find` problem disappears with it.
- Resolution is now a single `resolveReference(link, fromPath)` helper used by
  both scans, so "resolved, not raw" stays one truth (the property the reviewer
  verified: an unresolvable `![[missing.png]]` still cannot suppress an outline).
- I made the ascending-order guarantee explicit on `orderedReferences`' doc
  comment, since the early exit is now load-bearing on it.
- The comment at `ObsidianLinkProvider.ts:122` is softened as suggested: it now
  says the shared `getFileCache` read serves the title and the outline, and that
  `attachments` resolves through `resolvedOutgoingPaths` because that path also
  handles the canvas and not-yet-cached branches this read cannot answer.

**Partially rejected — threading one resolved array into both consumers.**
`attachmentsOf` goes through `resolvedOutgoingPaths`, which has three branches:
markdown-with-cache (offsets exist), fallback-parsed canvas, and
resolvedLinks-keys (markdown not yet cached). The latter two have **no document
offsets**. Unifying them behind one `ResolvedReference[]` needs either a
manufactured offset — a lie in a type whose whole point is a real document
coordinate — or a two-shape return value. That is more complexity than the
saving, and after the bounded scan above the saving is nearly gone anyway.
Behaviour verified unchanged by the existing 15 outline tests; a mutation check
(disabling the early exit) turns two of them red, so the bound is genuinely
exercised.

### m2 — `GraphStructureDiff` T30 cannot fail → **FIXED (relocated to where it can fail)**

Deleted the unfailable `describe("decideLayout node data changes")` (and the
stray double blank line above it). `decideLayout` never reads node data, so no
edit to the outline could ever turn that test red.

The contract T30 exists to protect — plan D1's "an outline change refreshes node
data without forcing a relayout" — is now pinned at the level where it is real,
in `GraphViewController.test.ts`:

- *THEN elk layout is not re-run (an outline change never forces a relayout)*
- *THEN the snapshot published off the reused layout carries the NEW outline*

Both were **verified failable by mutation** before committing:

| Mutation | Result |
|---|---|
| controller never takes the `reuse-layout` branch | first test FAILS |
| rebuild maps flow data from the previous graph | second test FAILS |

This is a net gain over T30: the second half of the contract (new data actually
reaches the node on the reuse path) had no test at all before.

**Behaviour-capturing test removed?** Only in the sense that a same-named,
never-red case is gone; the behaviour it named is now covered by two tests that
can fail. Flagging it loudly here as required.

### m3 — redundant `SettingsSpec` assertion → **FIXED**

Deleted "WHEN `EngineDefaults.viewSettings` is built THEN `outlineMaxDepth`
equals the spec default". The enumerated projection assertion 70 lines above
already pins `outlineMaxDepth: SETTINGS_SPEC.globalView.outlineMaxDepth.default`
field by field. The two spec-baseline cases (default `2`, limits `1..6/1`) stay —
they pin the shipped numbers, which the projection assertion deliberately does not.

### m4 — untested `file.extension === "md"` → `FileKinds.isMarkdownPath` widening → **FIXED**

New `describe("FileKinds.isMarkdownPath")` with three cases; the load-bearing one
is `NOTE.MD` → `true`, with a WHY comment naming the widening it pins. Worth the
test: `isMarkdownPath` now gates frontmatter titles and markdown link resolution
in the adapter, so this is a real behaviour change on case-varying vaults.

### m5 — `graphFixtures.makeViewSettings()` hardcodes `outlineMaxDepth: 2` → **REJECTED**

The fixture is deliberately decoupled from engine defaults ("Minimal effective
view settings for view-layer tests (neutral, engine-decoupled)") and every
neighbouring field is a literal (`nodeCap: 100`, `minPx: 40`, the whole
`forceLayout` block). Switching one field to `EngineDefaults` would make the
fixture half-projected and half-literal — worse than either. Repointing the whole
fixture at `EngineDefaults` is a wholesale pattern change (CLAUDE.md: change a
pattern wholesale, not one-off) that would couple view tests to spec drift, which
is the opposite of what these fixtures are for. The reviewer agrees it is "not a
new sin". No change.

### m6 — setting not yet in README/CHANGELOG → **OUT OF SCOPE (acknowledged)**

Plan step 10, owned by the next agent. Explicitly listed here so it is not lost:
`README.md`'s settings model and `docs-internal/CHANGELOG.md` both need
"Outline depth" (default 2, range 1–6, no on/off toggle).

---

## Files changed in this iteration

- `src/adapters/ReferenceOrder.ts` — deleted `orderedLinkTexts`; ascending-order
  guarantee documented on `orderedReferences`.
- `src/adapters/ReferenceOrder.test.ts` — three cases retargeted via `linksOf`.
- `src/adapters/ObsidianLinkProvider.ts` — `firstImageOffsetOf` →
  `referencesImageAbove`; new `resolveReference` helper; cache comment softened.
- `src/engine/SettingsSpec.test.ts` — redundant assertion removed.
- `src/shared/FileKinds.test.ts` — `isMarkdownPath` describe (+3).
- `src/view/GraphStructureDiff.test.ts` — unfailable outline case removed.
- `src/view/GraphViewController.test.ts` — outline data-refresh describe (+2),
  local `noteNode` helper.

No production behaviour changed in this iteration. No new file, no new layering
rule, no persisted-shape change, no `ap_XXX_E` anchor touched.

## Questions for the human

None.
