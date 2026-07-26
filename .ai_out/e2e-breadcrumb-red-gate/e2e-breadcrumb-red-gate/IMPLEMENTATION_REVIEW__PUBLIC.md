# IMPLEMENTATION_REVIEW — PUBLIC

Feature `e2e-breadcrumb-red-gate` · diff `f45082d..HEAD` (`60b6383`, `c2ea883`).

## Verdict on the central call

**IMPLEMENTATION is RIGHT and both exploration agents were WRONG.** The breadcrumb was
built, then deliberately removed. Verified independently against git history.

**1 BLOCKING issue** (trivial fix, ~3 lines). Gate claims **all reproduce exactly**.

---

## Adjudication: was `998fdac`'s removal deliberate and product-level?

**Yes — deliberate, product-level, and documented in four independent places.** Not
incidental collateral of a sizing change. Decisive evidence:

1. **Commit subject names it as a first-class goal**, not a side effect:
   `feat(node-real-estate): snug capped node width + remove folder prefix`
2. **Commit body**: "Removed the grayed folder breadcrumb entirely (render, CSS,
   reserved width, threading)."
3. **`_change_log/2026-07-23_22-16-50Z.md:17`** — the repo's own top-level change record:
   "Removed grayed folder breadcrumb end-to-end: render (NoteNode.tsx), CSS rule,
   reserved width (estimateNodeLabelWidthPx), FlowNodeData.breadcrumbFolder, threading in
   flowMapping/elkMapping, and breadcrumbFolderOf + its tests."
4. **`998fdac`'s own PUBLIC file**: "**Breadcrumb removed** end-to-end … No dead params /
   no `@Deprecated`." Plus an explicit callout that historical docs were left as record and
   "Only the authoritative `high-level-plan.md` Sizing section updated."

A change that removes render + CSS + data field + threading + derivation + tests + the
plan-doc sentence, and says so in the subject line, is not collateral.

### Does `high-level-plan.md` document the *absence*, or is it merely silent?

**It is SILENT — and IMPLEMENTATION's PUBLIC overstates this.** The `.ai_out` PUBLIC says
"The authoritative plan documents the *absence*." It does not; `grep -i breadcrumb
docs-internal/plan/high-level-plan.md` → 0 hits at HEAD, which is silence.

**But the stronger fact IMPLEMENTATION under-sold is decisive in its favour.** The plan
doc *did* previously specify the breadcrumb, and `998fdac` *deleted that sentence*:

```
998fdac^ high-level-plan.md:59
- …Ungrouped singletons reserve extra width for their `folder/` breadcrumb. The floor is a pure char-count estimate…
998fdac  high-level-plan.md:59
+ …its **width** snugly fits the title on one line — floored at the score-driven square and **capped** at NODE_MAX_LABEL_WIDTH_PX…
```

An affirmative deletion from the design source of truth is a decision, not silence. So the
conclusion holds on better evidence than the one cited. The **in-repo** wording is accurate
— `e2e/vicinityGraph.e2e.ts:87-88` says `998fdac` "also rewrote the authoritative
`high-level-plan.md` sizing model", which is exactly what happened. The overclaim is
confined to the `.ai_out` file. Minor, but worth correcting so nobody re-derives from it.

### Was `998fdac`'s deletion of the breadcrumb unit tests un-aligned?

**No — it was legitimate**, and this is a finding about the past either way, not a reason
to block. `998fdac` deleted 5 behavior-capturing tests (`flowMapping.test.ts` breadcrumb
`describe` ×4 + width-reservation test; `graphIdentity.test.ts` `breadcrumbFolderOf`
`describe` ×3). Deleting tests *for behaviour you are deliberately deleting* is correct —
the alternative is tests asserting a dead feature. It was disclosed in the commit body, the
change log, and the PUBLIC file.

**The real process gap it exposed** is different and worth a ticket: `npm test` stayed green
because the unit tests died with the feature, while the e2e gate — which is NOT part of
`npm test` — silently went red and stayed red for 3 days across at least two subsequent
branches (`_change_log/2026-07-24_03-57-33Z.md:20` misdiagnosed it as "pre-existing"). Any
feature removal has this blind spot.

### Is the ticket's "written rationale" requirement satisfied *in the repo*?

**Yes.** Not only in `.ai_out/`:
- `e2e/vicinityGraph.e2e.ts:85-95` — JSDoc naming the commit, date, and reason.
- `e2e/vicinityGraph.e2e.ts:171-177` — gamma-specific rationale.
- `docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md:5-21` — resolution
  section, with the original triage preserved below a `---` rather than overwritten. Good.
- `_tickets/e2e-release-gate-is-red-…md:52` — closing note.

---

## Independent gate verification

Re-ran everything myself. **Every claim reproduces. No discrepancies.**

| Gate | Claimed | Observed | Match |
|---|---|---|---|
| `npm run test:e2e` | exit 0, 78 passed / 1 skip | exit 0, 78 passed / 1 skip | ✅ |
| `npm test` | 990 passed | 990 passed (74 files) | ✅ |
| `npm run check` | exit 0 | exit 0 | ✅ |
| `npm run build` | exit 0 | exit 0 | ✅ |

Verbatim, `.tmp/review-e2e.log`:
```
  -   9 e2e/externalVault.e2e.ts:53:1 › WHEN VICINITY_E2E_VAULT points at a vault THEN its graph renders and is screenshotted
  ✓  63 e2e/vicinityGraph.e2e.ts:96:1 › no node renders a folder-prefix breadcrumb (1ms)
  ✓  73 e2e/vicinityGraph.e2e.ts:178:1 › singleton-folder note shows its trimmed frontmatter title (2ms)
  ✓  79 e2e/vicinityGraph.e2e.ts:248:1 › a low node cap surfaces the group badge and the corner overlay (102ms)

  1 skipped
  78 passed (51.9s)
E2E_EXIT_CODE=0
```
Verbatim, `.tmp/review-test.log`:
```
 Test Files  74 passed (74)
      Tests  990 passed (990)
```
`TEST_EXIT=0  CHECK_EXIT=0  BUILD_EXIT=0`.

**"Did not run" audit:** 0. All 79 numbered specs are accounted for — 78 `✓`, 1 `-`. The
single skip is `externalVault.e2e.ts:53`, env-gated on `VICINITY_E2E_VAULT` (unset by
design), **not** a serial-mode casualty. The 6 formerly-stranded serial tests
(`vicinityGraph.e2e.ts:178`→`:248`, numbers 73–79) all ran and passed. `git status` after
`build` shows no `main.js`/`styles.css` drift — the "byte-identical artifacts" claim holds.

---

## 🚨 BLOCKING

### B1. The replacement guard is **still vacuous** — it repeats the exact mistake its own comment claims to have fixed

`e2e/vicinityGraph.e2e.ts:92-97`:
```ts
 * This asserts vault-wide, not per-node: the previous note1-only version passed
 * vacuously (nothing rendered the class anywhere) and so could not tell "absent
 * for root notes" from "feature gone".
 */
test("no node renders a folder-prefix breadcrumb", async () => {
	await expect(page.locator(".vicinity-graph-node__breadcrumb")).toHaveCount(0);
});
```

Two problems, one of them an inaccurate claim committed to the repo:

**(a) It is not "vault-wide".** Playwright's `page.locator` sees only the currently rendered
DOM. At spec #63 the active file is still `ALPHA_PATH` (set in `beforeAll`, line 53), so the
graph holds exactly 3 nodes — alpha, beta, note1 (`:24`, and `:71` asserts
`ALPHA_NODE_COUNT === 3`). It is *alpha-vicinity-wide*, three nodes.

**(b) Those three nodes could never have had a breadcrumb, even before the removal.** Per
the deleted derivation at `998fdac^:src/view/graphIdentity.ts:49-54`:
```ts
export function breadcrumbFolderOf(node: GraphNode, isGrouped: boolean): string | undefined {
	if (isGrouped || node.folder === VAULT_ROOT_FOLDER) { return undefined; }
	return VaultPathFacts.folderNameOf(node.folder);
}
```
alpha + beta are **grouped** (`projects/`, 2 members — asserted at `:100`); note1 is at the
**vault root**. All three → `undefined`. **This test would have passed against pre-`998fdac`
code.** It cannot fail if the breadcrumb comes back, which is the only thing it purports to
guard. It is exactly as vacuous as the `:85` test it replaced.

This matters beyond test hygiene: the JSDoc asserts a coverage property the test does not
have. Per CLAUDE.md's identity clause ("the worst lie is making tests look like they are
passing when they are not… Silent fallbacks in test are lies"), a green test carrying a false
claim about its own reach is the thing to avoid.

**Fix (mechanical, ~3 lines).** Move the test into the note1 section, *after* line 157's
`await harness.openFile(NOTE1_PATH)`. The note1 vicinity contains `solo/gamma.md` — an
ungrouped singleton in a non-root folder (`:31`, and `:182` confirms `solo/` renders no
group box). That is precisely the node that *did* render `solo/` before `998fdac`, so the
guard becomes genuinely red-on-regression. Then correct the JSDoc: say "asserts across the
note1 vicinity, which includes the ungrouped singleton `solo/gamma.md` — the one node that
rendered a breadcrumb before `998fdac`", and drop the "vault-wide" claim.

Worth noting: **real coverage does already exist** — `:179`
`toHaveText(GAMMA_TRIMMED_TITLE)` is an *exact-text* assertion on gamma's title and would
fail loudly if `solo/` ever came back in the title text (the pre-`998fdac` DOM rendered the
breadcrumb *inside* `.vicinity-graph-node__title`). So the suite is not actually blind. B1 is
about the `:96` test being decoration that claims to be a guard — fix or delete it, don't
ship it mislabelled.

---

## ⚠️ SHOULD-FIX

### S1. `docs-internal/plan/steps/step-05-rich-rendering.md:45` — stale claim left in the file that was being corrected
> "Pure logic vitest-covered: … title/**breadcrumb** derivation."

False since `998fdac` deleted `breadcrumbFolderOf` and its tests. Two bullets in this file
were carefully marked SUPERSEDED (`:16`, `:24`) but this third one was missed — leaving the
doc that misled both exploration passes still half-misleading. Suggest: `title derivation
(~~breadcrumb~~ — superseded 2026-07-23)`.

### S2. `docs-internal/tickets/ticket-folder-color-ux-design-pass.md:8` — an **OPEN** ticket now rests on a false premise
> "Step 05 shipped neutral group styling … and folder identity via **breadcrumb titles on
> ungrouped nodes**."

This is not harmless historical record like the CHANGELOG — it is an open design ticket whose
"validate the neutral UX first" scope explicitly assumes ungrouped nodes carry folder
identity. They no longer do. A designer picking this up would design against reality.
Suggest a one-line note: "**2026-07-26:** the breadcrumb was removed in `998fdac`; ungrouped
nodes now carry NO folder identity — that raises the stakes for this pass."

### S3. The acknowledged UX gap was flagged but no ticket was filed
`IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` honestly raises it: "ungrouped non-root notes now
show no folder context at all. That is a live UX question… Not re-opened here." Correct call
not to re-open unilaterally — but CLAUDE.md is explicit: "Spot issues outside your task →
file a `docs-internal/tickets/` ticket, don't silently patch," and "Any ticket that requires
a human decision must have `[decide]` in its title."

A risk noted only in `.ai_out/` evaporates when the branch is merged and the next agent
greps `docs-internal/`. Suggest filing `[decide] ungrouped non-root nodes show no folder
identity since the breadcrumb removal` with the `998fdac` rationale (real estate) and the
counter-case, so the human can choose. Cheap, and it is the difference between "removed by
design" and "removed by design, and we checked that's still what we want".

### S4. Feature removals cannot go red on the unit gate — file a follow-up
Root cause of this whole ticket, and it is unaddressed. `npm test` excludes `test:e2e`
(CLAUDE.md: "release gate, not `npm test`"), so `998fdac` could delete a rendered feature,
delete its unit tests, stay green, and leave the e2e gate red for 3 days — long enough that
`_change_log/2026-07-24_03-57-33Z.md:20` recorded it as an accepted "pre-existing" failure.
Suggest a ticket for a cheap tripwire (e.g. a grep-based check that every CSS class asserted
in `e2e/**` exists in `src/view/*.css`/`*.tsx`, runnable in `npm test`). Would have caught
this in seconds. Out of scope here — a ticket, not a fix.

---

## 💡 NICE-TO-HAVE

### N1. `.ai_out` PUBLIC overclaims the plan-doc evidence
"The authoritative plan documents the *absence*" → it is **silent**. The correct and stronger
claim is "`998fdac` *deleted* the plan doc's breadcrumb sentence" (evidence quoted above).
Fix so a future reader doesn't inherit a weaker argument than the facts support. `.ai_out`
only — no repo impact.

### N2. `:96` test placement also makes it a duplicate
Once moved per B1, `:96` and `:179` both cover "no `solo/` prefix on gamma" from different
angles (class absence vs. exact title text). That is acceptable belt-and-braces; if you'd
rather keep one, `:179` is the stronger assertion and `:96` can simply be deleted with the
rationale JSDoc moved onto `:179`. Either resolution closes B1.

---

## ✅ REJECTED CONCERNS (checked, found clean)

- **"Test weakened to force green" / assertion-tuning HACK** — **No.** The gamma assertion
  changed from `toHaveText("solo/" + GAMMA_TRIMMED_TITLE)` to
  `toHaveText(GAMMA_TRIMMED_TITLE)`. `toHaveText` is exact-match, so the new form is not
  a loosening — it is a different exact expectation, and it still fails if a prefix
  reappears. No substring/regex softening, no `.skip`, no try/catch, no
  silent fallback anywhere in the diff. This is the honest correction the ticket allowed for.
- **Use-case coverage lost** — **No.** The gamma spec's two halves: the breadcrumb half is
  gone *because the feature is gone*; the trimmed-frontmatter-title half is preserved in e2e
  at `:179` **and** independently unit-covered at
  `src/adapters/ObsidianLinkProvider.test.ts:286` — `it("WHEN the title has surrounding
  whitespace THEN it is trimmed")` → verified passing against
  `ObsidianLinkProvider.ts:311-315` (`value.trim()`). Cited claim checks out exactly.
  Net behaviour coverage delta: **zero loss**.
- **`src/adapters/ObsidianLinkProvider.ts:313`** — comment-only ("titles and breadcrumbs" →
  "rendered node titles"). Read the full function: `frontmatterTitleOf` still trims, control
  flow untouched, `git diff` confirms one line. **Honest, masks nothing.**
- **`scripts/setup-dev-vault.sh:113` and `:409`** — both accurate. `:409` fixed an *actively
  wrong instruction* in the printed human smoke-test checklist (it told a human to look for a
  breadcrumb that cannot appear) — a genuine improvement, not cosmetic. The `write_if_missing`
  caveat (existing vaults keep the old comment) was proactively disclosed in PUBLIC and is
  comment text no assertion depends on. **Honest.**
- **Ticket/doc edits rewriting history misleadingly** — **No.** `ticket-e2e-gamma-breadcrumb-
  fails-headless.md` keeps the original triage verbatim under "Original triage (kept for the
  record)" and explicitly names which prior leads were wrong and why. The step-05 edits use
  strikethrough + SUPERSEDED rather than deletion. This is the right pattern.
- **Overriding the prior ticket's "do NOT weaken or delete the test"** — **Justified.** That
  instruction was written on a demonstrably false premise (it claimed `breadcrumbFolderOf`
  was "moved during the node width floored change"; it was **deleted**). IMPLEMENTATION
  documented the override in-repo rather than quietly ignoring it. Correct handling.
- **`src/` untouched** — verified: the only `src/` change in the diff is one comment line.
  Declining to re-add a deliberately-removed feature to turn a gate green was the right call;
  reviving it is a product decision.

---

## Documentation Updates Needed

- S1 (`step-05-rich-rendering.md:45`), S2 (`ticket-folder-color-ux-design-pass.md:8`),
  S3 (new `[decide]` ticket), S4 (new tripwire ticket).
- **No `CLAUDE.md` change needed.** The layering, gate, and guardrail sections all remain
  accurate; nothing here is stable knowledge that belongs there.

---

## Readiness to ship

**NOT YET — fix B1 first.** It is a ~3-line move plus a comment correction, no `src/` risk,
no re-run of the slow gate strictly required (though cheap to confirm).

After B1: **ready to ship.** The core judgment call — that this was a stale test and not a
missing feature — is correct, well-evidenced, and was reached by overriding two upstream
agents, which took real rigour. The gate is genuinely green and I verified all four claims
myself with zero discrepancies. S1–S4 are follow-ups that need not block the merge, though
S3 is the one I'd most want not to be forgotten.
