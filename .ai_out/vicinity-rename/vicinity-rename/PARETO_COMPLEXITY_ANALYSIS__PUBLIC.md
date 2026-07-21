# PARETO / COMPLEXITY ANALYSIS — `neighborhood` → `vicinity` rename

Role: PARETO_COMPLEXITY_ANALYSIS. Scope: right-sizing only. Correctness is trusted per the
IMPLEMENTATION_REVIEWER **APPROVED** verdict (not re-run here).

## Pareto Assessment: **PROCEED**

**Value Delivered:** Vocabulary + plugin-identity rename to `vicinity` (534-hit family),
with discoverability phrases ("local graph", "nearby notes") baked into both descriptions.
Core problem solved cleanly.

**Complexity Cost:** One throwaway Python script (`.tmp/vicinity-rename/rename.py`,
untracked), two passes (content + `git mv`), idempotent. No new abstractions, no config
surface, no production-code complexity added. Version untouched.

**Ratio:** **High.** This is close to the ideal 80/20 shape — a mechanical, reversible edit
delivered by a single disposable tool, gated by tsc as the one convergence check.

## Right-sizing observations

1. **Appropriately sized — no over-engineering.** A one-shot literal-replacement script is
   exactly proportionate to a one-time migration. Ordered case-sensitive replacements
   (id-special → plural → singular) and "write-only-on-change" idempotency are the minimum
   robustness needed, not gold-plating. British-form handling (0 hits) is trivially cheap
   insurance, not scope creep.

2. **Throwaway (not `scripts/`) was the correct 80/20 call.** The script has no recurring
   use — the rename happens exactly once, then the vocabulary is gone. Keeping it in
   `scripts/` would add a permanent maintenance/discoverability liability (dead code inviting
   "what is this? does it still work?") for zero future value. Deleting it is the classic
   YAGNI-correct move. Keeping it untracked in `.tmp/` is right.

3. **Scope correctly bounded — value not left on the table.** Deliberately preserving the
   graph-theory term `neighbor(s)/neighboring` is the sharp, correct scoping decision: it
   avoids corrupting domain-correct vocabulary (over-broad) while still renaming everything
   user-facing (not too narrow). Descriptions reworded for discoverability captured the
   available marginal value. No adjacent-problem drift.

4. **Deviation was proportionate.** The single RELEASE_CHECKLIST tidy was justified (the
   bullet became self-contradictory post-rename) and self-corrected when it briefly
   reintroduced the literal. Low cost, appropriate ownership — not scope creep.

## Residual risk (follow-up tickets — all LOW, none blocking)

- **View-type string change for already-installed dev vaults (LOW).** `neighborhood-graph-view`
  → `vicinity-graph-view` means any open view in a pre-existing local/dev vault won't
  restore (Obsidian can't resolve the retired view type); the leaf is simply dropped and
  reopened. Zero real users at `0.1.0`, so impact is a dev re-opening a pane once. Worth a
  one-line ticket noting it, not worth migration code (that would be textbook
  complexity-exceeds-value).

- **README repo-URL vs plugin-id distinction (LOW).** Confirm the mechanical rename didn't
  rewrite a real GitHub **repo URL** (repo slug) into the new plugin id where the two must
  differ. A quick ticket to eyeball install/clone URLs; cheap to verify, cheap to skip if
  already checked.

- **e2e view-type constant dedup (LOW, PRE-EXISTING).** `VIEW_TYPE_VICINITY_GRAPH` is
  re-declared in `e2e/obsidianHarness.ts`. Already tracked by
  `docs-internal/tickets/ticket-e2e-view-type-constant-dedup.md`. Not introduced or worsened
  here — no new action; the existing ticket suffices.

**Recommendation:** Proceed / ship as-is. Optionally open two LOW tickets (view-type change
note; README URL-vs-id check). Do **not** add view-migration code — its complexity would far
exceed the value at a zero-install `0.1.0`.
