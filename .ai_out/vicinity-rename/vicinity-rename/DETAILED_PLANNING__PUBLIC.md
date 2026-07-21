# DETAILED PLAN — `neighborhood` → `vicinity` rename (script-driven)

Role: PLANNER. Branch: `vicinity-rename`. Decisions in `CLARIFICATION__PUBLIC.md` are FINAL.
This plan is implementation-ready: a skilled dev + the migration script execute it end-to-end.

---

## 1. Problem understanding

Rename the entire `neighborhood` vocabulary to `vicinity` across the repo — file
**contents**, **file basenames**, and **plugin/package identity** — driven by a single
reusable script (human requirement: not manual per-file LLM edits). Zero regressions:
`npm run check` (tsc) and `npm test` (vitest + sublib) must fully pass, with the test
count preserved. The graph-theory term `neighbor(s)/neighboring/neighbour(s)` is
explicitly OUT of scope and must survive untouched.

### Verified scope (ground truth, tracked files, exclusions applied)
- Case-form line counts: `neighborhood` 317, `Neighborhood` 167, `NEIGHBORHOOD` 15, `neighbourhood` 0.
- **12** files carry a `neighborhood` basename (exploration said 8 — it collapsed variants). Full list in §4.
- ~60 `.neighborhood-graph-*` CSS classes, referenced by identical string literals in `*.tsx` + every e2e spec.
- ID/literal strings: view-type `neighborhood-graph-view`; command ids `open-neighborhood-graph`, `debug-log-neighborhood-graph`; plugin id `obsidian-neighborhood-graph`.

### Two edge cases that a naive `sed s/neighborhood/vicinity/g` gets WRONG
1. **Plural** `neighborhoods` (4× in prose) → must become `vicinities`, not `vicinitys`.
   Fix: replace plural BEFORE singular.
2. **Plugin id** `obsidian-neighborhood-graph` → target is `vicinity-graph` (drop the
   `obsidian-` prefix), NOT `obsidian-vicinity-graph`. Fix: a special-case replacement
   applied BEFORE the generic rules.

### Substring-safety (why `neighbors` is never hit)
The literal substring `neighborhood` only ever occurs inside the target word — the bare
graph term `neighbor`/`neighbors`/`neighboring`/`neighbour(s)` does **not** contain the
substring `neighborhood` (it lacks the `hood`). So a **literal-substring** replace of
`neighborhood` cannot touch the graph term. No `\b` word-boundary tricks are required;
the only ordering constraints are plural-first and id-special-first (above).

---

## 2. High-level approach

A single Python migration script performs two mechanical passes:

```
Pass 1 — CONTENT: for every tracked, non-excluded, text file, apply an ORDERED list of
                  case-sensitive literal replacements (id-special → plural → singular).
Pass 2 — RENAME:  for each of the 12 files whose basename matches, derive the new
                  basename via the same replacement fn and `git mv` old → new.
```

Because import specifiers (`./NeighborhoodTraversal`), CSS-class literals, the view-type
string, command ids, and camelCase symbols (`neighborhoodGraphToFlow`, type
`NeighborhoodGraph`, class `NeighborhoodGraphPlugin`) are all **plain tokens** containing
the same casing forms, Pass 1 fixes them automatically — there is **no separate
import-fixup pass**. Pass 2 only makes the physical filenames agree with the (already
updated) import paths.

Two things Pass 1 canNOT do and are handled manually after it:
- The **description** rewrite (must drop `neighboring` — a bare-neighbor term outside the
  rename family — and add the mandated phrases). See §6.
- (Optional tidy) marking the RELEASE_CHECKLIST deferred-id bullet as done. See §9.

**Recommended script location: `.tmp/vicinity-rename/rename.py` (throwaway).**
Rationale (KISS/OCP): this is a one-shot migration; `scripts/` holds live dev tooling
(`run-e2e.sh`, `setup-dev-vault.sh`) and committing a dead one-shot there violates
"no unused code" and that dir's SRP. Provenance is preserved by the migration commit
itself + these `.ai_out/` planning docs. (Alternative if in-repo provenance is desired:
`scripts/migrations/`, but not recommended.)

---

## 3. The replacement rules (exact, ordered)

Apply in this order. All matches are **case-sensitive literals** (no regex needed beyond
literal find/replace; a regex-callback variant is noted at the end).

| # | Find (literal) | Replace | Why this order |
|---|---|---|---|
| 1 | `obsidian-neighborhood-graph` | `vicinity-graph` | id must drop `obsidian-` prefix; must run before generic rules |
| 2 | `Neighborhoods` | `Vicinities` | plural before singular (none found today; robustness) |
| 3 | `neighborhoods` | `vicinities` | plural before singular (4 real hits) |
| 4 | `NEIGHBORHOOD` | `VICINITY` | uppercase form (e.g. `VIEW_TYPE_NEIGHBORHOOD_GRAPH`) |
| 5 | `Neighborhood` | `Vicinity` | Pascal/camel-internal (`NeighborhoodGraphView`, `neighborhoodGraph…` gets its cap via rule 6/5 mix) |
| 6 | `neighborhood` | `vicinity` | lowercase incl. kebab (`neighborhood-graph`→`vicinity-graph`) |

Notes:
- British `neighbourhood`/`neighbourhoods` = 0 occurrences; add analogous rules only if a
  future run finds them (cheap; recommend including for robustness).
- camelCase `neighborhoodGraphToElk` → rule 6 gives `vicinityGraphToElk`. `NeighborhoodGraph`
  (Pascal) → rule 5. Both correct.

Alternative single-regex form (equivalent, if the implementer prefers one pass):
`re.sub(r'[Nn]eighbou?rhoods?', callback)` where `callback` inspects the match to pick
plural/case, PLUS a prior literal replace of `obsidian-neighborhood-graph`→`vicinity-graph`.
The ordered-literal table above is the KISS recommendation.

### Script requirements (behavioral contract)
- **File selection:** iterate `git ls-files` with pathspecs excluding
  `submodules/**`, `.ai_out/**`, `package-lock.json`, `ask.dnc.md` (plus `.git`,
  `node_modules` are already untracked). `docs-internal/**` IS in scope.
- **Text-only:** skip files that don't decode as UTF-8 text (guard against binaries).
- **Idempotent / re-runnable:** only write a file when content actually changes; on
  re-run (nothing left to match) it must be a no-op. Pass 2 must skip a `git mv` whose
  source no longer exists / target already present.
- **Summary output:** print per-pass counts — files changed, total replacements by rule,
  and the list of `git mv` operations performed.
- **No hidden state:** deterministic; safe to run twice.

---

## 4. Files to rename (Pass 2) — all 12

Derive each target by applying the rule table to the **basename** only.

| Old path | New path |
|---|---|
| `src/adapters/NeighborhoodGraphBuilder.ts` | `src/adapters/VicinityGraphBuilder.ts` |
| `src/adapters/NeighborhoodGraphBuilder.test.ts` | `src/adapters/VicinityGraphBuilder.test.ts` |
| `src/engine/NeighborhoodEngine.ts` | `src/engine/VicinityEngine.ts` |
| `src/engine/NeighborhoodEngine.test.ts` | `src/engine/VicinityEngine.test.ts` |
| `src/engine/NeighborhoodEngine.denseFixtures.test.ts` | `src/engine/VicinityEngine.denseFixtures.test.ts` |
| `src/engine/NeighborhoodTraversal.ts` | `src/engine/VicinityTraversal.ts` |
| `src/engine/NeighborhoodTraversal.test.ts` | `src/engine/VicinityTraversal.test.ts` |
| `src/view/NeighborhoodEdge.tsx` | `src/view/VicinityEdge.tsx` |
| `src/view/NeighborhoodGraphFlow.tsx` | `src/view/VicinityGraphFlow.tsx` |
| `src/view/NeighborhoodGraphSettingTab.ts` | `src/view/VicinityGraphSettingTab.ts` |
| `src/view/NeighborhoodGraphView.tsx` | `src/view/VicinityGraphView.tsx` |
| `e2e/neighborhoodGraph.e2e.ts` | `e2e/vicinityGraph.e2e.ts` |

All import specifiers referencing these (28 sites in `src/**`, incl. `engine/index.ts`
barrel, `main.ts`, `truncationHarness.ts`) are updated by Pass 1 before the physical move.

---

## 5. Config / manifest / identity changes (via Pass 1 rules + §6 manual)

| Field | File | From → To | Mechanism |
|---|---|---|---|
| `id` | manifest.json | `obsidian-neighborhood-graph` → `vicinity-graph` | rule 1 |
| `name` | manifest.json | `Neighborhood Graph` → `Vicinity Graph` | rules 5/6 |
| `name` | package.json | `obsidian-neighborhood-graph` → `vicinity-graph` | rule 1 |
| view-type | NeighborhoodGraphView.tsx + harness | `neighborhood-graph-view` → `vicinity-graph-view` | rule 6 |
| command ids | main.ts | `open-neighborhood-graph`, `debug-log-neighborhood-graph` → `open-vicinity-graph`, `debug-log-vicinity-graph` | rule 6 |
| `version` | manifest/package/versions.json | **UNCHANGED `0.1.0`** | not matched by any rule |
| `description` | manifest.json + package.json | rewritten | **MANUAL, §6** |

`esbuild.config.mjs` needs no edit: it reads `manifest.id` at build time and derives the
dev-vault plugin dir from it, so it picks up `vicinity-graph` automatically.

---

## 6. Description rewrite (manual — after Pass 1)

Current (both manifest.json + package.json):
`"Improved visualization of neighboring notes (envisioned to be used in place of local graph)."`

`neighboring` is a bare-neighbor term (OUT of the rename family) so Pass 1 leaves it —
it must be removed by hand. CLARIFICATION requires the phrases **"local graph"** and
**"nearby notes"**, and no `neighboring`.

Proposed (PLANNER may refine wording; MUST keep both phrases, MUST drop `neighboring`):
`"A richer local graph that shows the nearby notes around your active note (an improved alternative to Obsidian's built-in local graph)."`

Apply the identical string to both files (they must stay in sync).

---

## 7. Ordering of operations & clean git history

1. **Write** `.tmp/vicinity-rename/rename.py`.
2. **Pass 1 — content** (script): ordered replacements across all in-scope files.
3. **Manual — description**: edit the two `description` values (§6).
4. **Pass 2 — renames** (script): `git mv` the 12 files (§4).
5. **`npm run check`** (tsc -noEmit) — compile gate; imports must resolve to new filenames.
6. **`npm test`** (vitest + sublib) — full suite green, count preserved (§8).
7. **e2e compile check** (§8) — `npx tsc -p` / included in `npm run check` scope if e2e is under tsconfig; e2e is NOT run by `npm test`.
8. **Optional tidy** (§9).
9. **Commit** once, on `vicinity-rename`, message e.g.
   `rename: neighborhood → vicinity vocabulary + plugin id/name (script-driven)`.
   Because Pass 2 uses `git mv`, git records renames (with content edits) — history stays
   traceable via `git log --follow`. Keep the throwaway script OUT of the commit
   (it lives under `.tmp/`, untracked).

Run Pass 1 then Pass 2 (not interleaved): content-first guarantees import paths already
point at the new names before the files move, so tsc after step 4 is the first and only
convergence check needed.

---

## 8. Acceptance criteria (automated)

Run from repo root; every check must hold:

1. **No `neighborhood` vocabulary remains** (only graph-term `neighbor(s)/neighboring` allowed):
   ```bash
   git grep -niI 'neighbo' -- . ':(exclude)submodules/**' ':(exclude).ai_out/**' \
     ':(exclude)package-lock.json' ':(exclude)ask.dnc.md' \
     | grep -iE 'neighbo(u)?rhood' 
   # → expect ZERO lines
   ```
2. **No file basename contains `neighborhood`:**
   ```bash
   git ls-files | grep -i neighborhood   # → ZERO
   ```
3. **Graph term preserved** (sanity — must still be non-empty):
   ```bash
   git grep -niI 'neighbor' -- src/engine/GraphTruncator.ts   # → still present
   ```
4. **Identity correct:** `manifest.json` id `vicinity-graph`, name `Vicinity Graph`;
   `package.json` name `vicinity-graph`; view-type `vicinity-graph-view`; version still `0.1.0`.
5. **Descriptions** contain both `local graph` and `nearby notes`, and do NOT contain `neighboring`.
6. **`npm run check`** passes (tsc clean).
7. **`npm test`** passes; **test count unchanged** (~559 root vitest tests + 69 sublib per
   the current CHANGELOG baseline — the rename adds/removes no tests).
   PREREQUISITE: `node_modules` may be absent in a fresh checkout — run `npm ci` first,
   then capture the ACTUAL pre-rename count (`npx vitest run`) and assert equality
   post-rename rather than trusting the literal 559 (that figure is an unverified approximation).
8. **e2e compiles** (tsc over `e2e/**`) — note e2e is separate from `npm test`; the
   renamed `e2e/vicinityGraph.e2e.ts` and updated CSS-class/PLUGIN_ID/view-type literals
   must typecheck.

---

## 9. Edge cases & special handling

- **Plural `neighborhoods`** (README.md:24, high-level-plan, step-02, step-07) → `vicinities`
  via rule 3. Do NOT let rule 6 reach them first. (Primary correctness risk — covered.)
- **Plugin id prefix** `obsidian-neighborhood-graph` → `vicinity-graph` via rule 1 (NOT
  `obsidian-vicinity-graph`). Covers manifest, package.json, `manifest.test.ts` expected
  value + assertion prose ("approved '…'"), `e2e/obsidianHarness.ts` PLUGIN_ID, README
  install path, RELEASE_CHECKLIST.
- **Tests that hardcode strings** — all fixed by Pass 1, verify post-run: `src/manifest.test.ts`,
  `src/persistence/DocDataStore.test.ts`, `src/persistence/OrphanSweeper.test.ts`,
  `e2e/obsidianHarness.ts`.
- **`[[wiki.links]]`** — the docs use `[[plan/steps/step-07-hardening]]` etc.; none contain
  `neighborhood`, so links are untouched. If any did, rule replacement inside `[[ ]]` is
  still the intended behavior (link + file rename move together) — but none exist here.
- **Root `_tickets/` dir** — the tracked root-level `_tickets/*.md` (distinct from
  `docs-internal/tickets/`) contains `neighborhood` hits (e.g. `e2e/neighborhoodGraph.e2e.ts`,
  `.neighborhood-graph-pin-button`). It is NOT in the exclusion list, so the `git ls-files`
  selection (Pass 1) and the acceptance grep both cover it automatically — no special
  handling needed, noted here only for completeness.
- **`ap_XXX_E` anchors** — none intersect the rename family; preserved (no rule matches them).
- **CSS classes** (`graph-view.css`) + their string-literal uses in `*.tsx`/e2e swap in
  lockstep via rule 6 (kebab). No orphaned class names.
- **CHANGELOG / RELEASE_CHECKLIST historical entries** — RECOMMENDATION: **blanket-replace
  them too** (docs-internal is in scope). Two reasons: (a) keeps acceptance grep at zero;
  (b) the CHANGELOG cites now-renamed files (e.g. `NeighborhoodEngine.denseFixtures.test.ts`)
  and tickets cite `e2e/neighborhoodGraph.e2e.ts` — leaving those stale would be worse than
  lightly rewording history. The one genuinely historical line is
  `RELEASE_CHECKLIST.md:43-48` (the *deferred* `obsidian-` id decision, now executed);
  after rule 1 it reads as if the id were always `vicinity-graph`. **Optional tidy:** mark
  that checklist bullet done / note the rename executed. Flagged, non-blocking — implementer's
  judgment; does not affect tests.

---

## 10. Open questions

None blocking — all decisions are settled in CLARIFICATION. The only discretionary item is
the optional RELEASE_CHECKLIST historical-bullet tidy (§9), which is cosmetic and does not
gate acceptance.
