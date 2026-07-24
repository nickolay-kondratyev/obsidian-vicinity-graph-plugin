# IMPLEMENTATION_REVIEW_PART1__PUBLIC — node-outline steps 1–5

Reviewer: `IMPLEMENTATION_REVIEWER_PART1`. Scope: plan steps **1–5** only
(`6e6e628`, `adf4fb8`, `750de65`, `bf17505`, `9bb109d`). Steps 6–10 absent by
design — not a finding. Reviewed the **diff** (`git diff main...HEAD -- src/`),
not the implementer's PUBLIC file; every claim below was checked against source.

## Verdict

**CHANGES REQUIRED** — one MAJOR cleanup (newly dead public API), plus minors.
**No blocking issues, no incorrect behaviour, no weakened tests.** The requested
change is ~10 lines and does not block starting steps 6–10; it should land on
this branch before merge.

## Gates I ran myself

| | |
|---|---|
| `npm run check` | **clean** |
| `npm test` | **787 passed / 3 failed** — exactly the three known pre-existing failures (`SettingsSpec.test.ts` ×2, `forceLayoutSettings.test.ts` ×1, `collidePaddingPx` 20 vs 50 from `22bd5cb`). |
| `./sanity_check.sh` | not present in this repo |
| `npm run test:e2e` | not run (out of scope per task) |

**The three known failures were NOT touched or re-pinned.** Verified from the
diff: `src/engine/SettingsSpec.test.ts` has additions only (no `-` line inside
the two baseline `it`s), and `src/engine/forceLayoutSettings.test.ts` is not in
the diff at all. Settled — not re-litigated.

## 🚨 BLOCKING

None.

## ⚠️ MAJOR

### M1 — `ReferenceOrder.orderedLinkTexts` is now dead production code

**Issue.** After step 2, `orderedLinkTexts` has **zero** production callers.
`ObsidianLinkProvider.orderedMarkdownReferences` calls `orderedReferences`
directly; `grep -rn "orderedLinkTexts" src/ e2e/` returns only its own
definition (`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1/src/adapters/ReferenceOrder.ts:46`)
and its three tests.

**Why it matters.** It is a public static on a seam class that now exists solely
to be tested — exactly the "unused code" / clean-break rule in CLAUDE.md, and it
leaves two parallel test suites in `ReferenceOrder.test.ts` asserting the same
ordering knowledge (DRY). A later reader cannot tell it is vestigial.

**Concrete fix.** Delete `orderedLinkTexts`; retarget the three pre-existing
`describe("ReferenceOrder.orderedLinkTexts")` cases at `orderedReferences`
(assert `.map(r => r.link)` so the assertions stay behavioural). **Do not drop
the third case** — `orderedLinkTexts({})` → `[]` (empty cache) has **no**
equivalent among the two new `orderedReferences` tests, so that behaviour would
otherwise lose its only guard. Net: same coverage, one API.

## 💡 MINOR (optional)

### m1 — the "one resolution pass" claim in plan D3 is not what shipped

`getFileMetadata` now runs the reference-resolution loop **twice** per file:
`attachmentsOf` → `resolvedOutgoingPaths` → `orderedMarkdownReferences`, and
`outlineOf` → `firstImageOffsetOf` → `orderedMarkdownReferences` again. Plan D3
step 2 said both consumers "read one resolution pass"; the code shares the *code
path*, not the *execution*. `firstImageOffsetOf` also resolves **every**
reference eagerly before `.find` short-circuits at the first image.

Impact is small in context (a `getFirstLinkpathDest` per reference per visited
node, next to an elk+d3 layout and a WASM routing pass), which is why this is
minor — but the fix is cheap: resolve once in `getFileMetadata`
(`const references = this.orderedMarkdownReferences(...)`) and pass the array to
both `attachmentsOf` and `outlineOf`, or at minimum iterate lazily in
`firstImageOffsetOf` and stop at the first image. Also worth softening the
comment at `ObsidianLinkProvider.ts:122` so it does not read as "everything is
shared now" — only the `getFileCache` read is.

### m2 — `GraphStructureDiff.test.ts` T30 cannot fail today

`decideLayout` never reads node `data`, so the new "outline change → reuse-layout"
test is unfailable by construction. The implementer flagged this honestly and the
plan mandates it as a guard on D1. I'd keep it only if the human wants the guard;
otherwise it is test surface that can never go red. Either way it is not a
weakening. (Also a stray double blank line was introduced above the new
`describe` in that file.)

### m3 — redundant assertion in `SettingsSpec.test.ts`

"WHEN `EngineDefaults.viewSettings` is built THEN `outlineMaxDepth` equals the
spec default" (line ~181) restates a line already inside the enumerated
projection assertion 70 lines above in the same file. One of the two is enough.

### m4 — silent (benign) widening from `file.extension` → `FileKinds.isMarkdownPath`

`frontmatterTitleOf` and `resolvedOutgoingPaths` previously compared Obsidian's
`TFile.extension` to `"md"`; they now call `FileKinds.isMarkdownPath(file.path)`,
which lower-cases the extension (`VaultPathFacts.extensionOf`). A `NOTE.MD` file
now takes the markdown branch where it previously may not have. This is an
improvement and consistent with the rest of `FileKinds`, but it is a behaviour
change with no test. One `it` on `isMarkdownPath("A.MD")` would pin it.

### m5 — `graphFixtures.makeViewSettings()` hardcodes `outlineMaxDepth: 2`

Duplicates the shipped default in a fixture. Consistent with the pre-existing
`nodeCap: 100` literal beside it, so not a new sin — but `EngineDefaults.viewSettings()`
would keep fixtures honest as the spec evolves.

### m6 — user-visible setting not yet documented

`README.md` (user-facing settings model) and `docs-internal/CHANGELOG.md` do not
mention "Outline depth". Plan step 10 owns docs, so this is a reminder, not a
step-1–5 defect. Confirm it lands there.

## Explicitly checked and found sound — do not revisit

**Requirement fidelity (CLARIFICATION).**
- Markdown-only outline parsing; `.excalidraw.md` excluded from parsing **and
  still node-bearing** — pinned twice, at `FileKinds` level and at the adapter
  level (`isNodeBearing === true` for `draw/x.excalidraw.md`). Q4 satisfied.
- Case-insensitivity of the excalidraw suffix is genuinely exercised:
  `VaultPathFacts.extensionOf` lower-cases, so `X.Excalidraw.MD` reaches the
  suffix check as markdown and is rejected there — the test is not vacuous.
- Depth 1–6, default 2, slider, **no on/off toggle anywhere**. The `min 1` clamp
  applied in *both* the slider and `parseViewOverride` means a hand-edited
  `"outlineMaxDepth": 0` cannot become a covert off-switch (tested).
- `OutlineEntry.rawText` is Obsidian's heading text verbatim (inline markdown
  intact) and is documented as the link key; the "verbatim" test asserts a
  heading containing `[[note1]] **today**`.

**Image-vs-outline rule — all combinations.** Correct and covered: headings+no
image → outline; image **after** first heading → outline; image **before** first
heading → `[]`; frontmatter image → `[]` (via `FRONTMATTER_REFERENCE_OFFSET = -1`,
which is `< ` every heading offset by construction); image + no headings → `[]`;
no headings → `[]`; non-image attachment before the first heading with the image
after it → outline. The comparison runs over **resolved** references, so the
image that suppresses the outline is exactly the image that would be rendered as
the thumbnail — an unresolvable `![[missing.png]]` cannot produce a blank node.
The empty-array encoding behaves as the plan claims at the seam, and D3b already
made the three-way view choice (`nodePreviewChoice`) a step-7 deliverable, so the
"depth filter empties the outline → falls back to the image" case is an approved
decision, not an accident.

**No `firstImagePath` / ordering regression.** `resolvedOutgoingPaths` still
returns `dedupe(<same ordered list>)`; dedupe cannot change which image is first;
`attachmentsOf` is unchanged downstream. T21 asserts the **full ordered**
attachments array (`[pic.png, doc.pdf]` from offsets 10/30) — the real hazard of
the refactor is pinned, not merely smoke-tested. The two pre-existing
`orderedLinkTexts` ordering tests still pass unmodified.

**Layering & purity.** No `obsidian`/`obsidian-id-lib`/`react` import added under
`src/engine/` or `src/shared/` (`importGuard.test.ts` guards both dirs and is
green). `HeadingPort` is a structural slice living in `src/adapters/obsidianPorts.ts`;
`OutlineEntry` is an engine-owned POJO in `src/engine/types.ts`, re-exported from
`src/engine/index.ts`. Ports were extended **additively** (`CachedMetadataPort.headings?`,
`FakeFileSpec.outline?`); no existing seam was rewritten. `FileMetadata.outline`
and `GraphNode.outline` are **required**, so `tsc` enforced every construction
site — a compile-time check over a runtime default, per repo standards.

**Settings plumbing — every touch point wired.** `SETTINGS_SPEC.globalView.outlineMaxDepth`
(`BoundedNumberSpec`) → `ViewSettings.outlineMaxDepth` → `EngineDefaults.viewSettings()`
→ `ViewSettingsResolver.resolve` (participates in the main/pinned cascade, tested
both ways) → `parseViewOverride` (clamped with the *same* `clampOutlineMaxDepth`)
→ `planSettingsWrite("global-outline-depth")` → `VicinityGraphSettingTab`
("Node contents" card, bounds *and* step read from the spec) → `saveGlobalView` →
`refreshOpenViews()`. Persistence round-trip survives mangled data: valid 4, `0`,
`99`, absent, and non-number `"deep"` are all covered, and `parsePluginData`
merges over `EngineDefaults` so a partial `globalView` cannot yield `undefined`.

**Live propagation.** On the `reuse-layout` path `GraphViewController` still calls
`vicinityGraphToFlow(graph, …)` on every rebuild (only positions/group dimensions
are reused), so a depth change or an edited heading reaches node data without a
relayout — the T30 contract holds in practice, not just in the diff.

**DRY/SRP.** `ReferenceOrder` remains the single ordering truth; the outline rule
lives entirely in the adapter (the only layer that can see offsets); the depth
filter lives entirely in the view mapping; `clampOutlineMaxDepth` is shared by the
slider and the parser instead of being written twice. No magic numbers —
`OUTLINE_RENDER_LIMIT = 40` is named with a WHY, and the slider step is projected
from the spec rather than retyped (a good deviation, agreed).

**Deviations declared by the implementer.** Both are sound: `frontmatterTitleOf`
as a module-level function matches the file's existing idiom and no longer touches
`this`; reading the slider step from the spec is strictly better than a second
literal `1`.

## Test integrity — nothing was weakened

`git diff main...HEAD -- '*.test.ts' '*.test.tsx' | grep '^-'` yields **three
lines, all import statements**. Zero assertions, `it`s or `describe`s were
deleted, relaxed, skipped or re-pinned anywhere in the branch. The only
modifications to existing assertions are three *additions* of `outline: []` /
`outlineMaxDepth` to full-object `toEqual` assertions that enumerate every field —
required by a new required field, and they still pin every other field.

Spot-checks that the new tests can actually fail: the "no image" and "image after
heading" cases return `["Intro"]` from the same fixture shape that the "image
before heading" case asserts `[]` for, so the empty-outline assertions are not
passing for an unrelated reason; `FakeObsidianPorts.getFileCache` genuinely
returns `null` for an unlisted file, so the cache-miss test (T15) exercises the
`cache === null` branch rather than the `headings === undefined` one (T14); the
filter-before-slice test would fail under slice-then-filter. The only unfailable
new test is the acknowledged T30 (m2).

Planned acceptance tests T1–T34 and T44–T55 are all present. None were silently
dropped.

## Documentation updates needed

- Step 10 must add the "Outline depth" setting to `README.md`'s settings model
  and a `docs-internal/CHANGELOG.md` entry (m6).
- No `CLAUDE.md` / `architecture-map.md` change is required by steps 1–5: no new
  directory, no new layering rule, no new persisted shape version.

## Questions for the human

None blocking. (The verify-first staleness ticket from CLARIFICATION round 2 is
plan step 10's deliverable — correctly absent here.)
