# IMPLEMENTATION_REVIEW_ITERATION — PUBLIC (verification pass, iteration 1)

Feature `e2e-breadcrumb-red-gate` · verified range `b9fb631..712a73c` · fresh reviewer instance.

**Verdict: 0 BLOCKING. B1 is genuinely fixed. All four gates re-verified green by me. Ready to ship.**

---

## 1. B1 — genuinely fixed ✅

| Check | Result |
|---|---|
| `git diff b9fb631..HEAD -- src/` | **empty** — `src/` is byte-identical. No behaviour re-added. |
| Guard placement | `e2e/vicinityGraph.e2e.ts:177`, i.e. **after** `:143 await harness.openFile(NOTE1_PATH)` and before the theme section. Nothing between `:143` and `:177` changes the active file (`:148` is note1's thumbnail). Placement is correct. |
| `solo/gamma.md` genuinely in that vicinity | Yes, on three independent legs: `:31-32` enumerates the 11-node note1 vicinity including gamma; `:189` locates `.vicinity-graph-node[data-path="solo/gamma.md"]` and passed in my run; `scripts/setup-dev-vault.sh:109` creates `solo/gamma.md` as the folder's **only** note, so `solo/` renders ungrouped (2+ rule) and is non-root — exactly the surviving `!isGrouped && folder !== root` case. |
| JSDoc accuracy | `:156-176`. The false "vault-wide" claim is **gone**. Every remaining claim checks out: the `998fdac` attribution, the `breadcrumbFolderOf` return contract, the reason the alpha vicinity cannot serve, and the mutation record. I found **no** surviving overstatement. |

**Is the mutation proof credible? Yes — and it is internally checkable.** The maker reports the
guard going red at spec **#13** with `12 passed`. Counting `test(` calls preceding the guard in
file order gives exactly 12 (ten alpha-section + `:142` + `:148`), and the guard's old home was
position #4 — inside that green block. So the log is arithmetically consistent with both claims
it is used to support: (a) the guard bites on a faithful regression (`Received: 1` = gamma, the
only such node), and (b) the old placement provably could not have caught it. The discarded
cruder mutation was disclosed rather than buried, which is the honest handling. The DOM shape
the mutation reproduces matches `998fdac^:src/view/NoteNode.tsx:87-92` (breadcrumb `<span>`
nested inside `.vicinity-graph-node__title`), which I verified myself. I did not need to redo it.

## 2. The five accepted items — all landed accurately ✅

- **S1** `docs-internal/plan/steps/step-05-rich-rendering.md:45` — now `title derivation
  (~~breadcrumb derivation~~ — SUPERSEDED 2026-07-23 by 998fdac …)`. Matches the SUPERSEDED
  convention already used at `:16`/`:24` in that file. Accurate and succinct.
- **S2** `docs-internal/tickets/ticket-folder-color-ux-design-pass.md:10` — dated UPDATE block
  added *above* the original text rather than rewriting it; names the consequence and links the
  new `[decide]` ticket. Correct pattern.
- **S3** `_tickets/decide-ungrouped-non-root-notes-show-no-folder-identity-since-the-breadcrumb-removal.md`
  (`nid_rdx8ea6w1km9eywyvhpx1v7rt_e`) — **yes, a human can actually decide from this.** It carries
  the four things a decision needs: what was removed (file-by-file), *why* it was removed (node
  real estate, not a judgement that folder identity is worthless), the concrete user-visible
  consequence with a named fixture (`solo/gamma.md` renders as a bare title), and four ranked
  options from "accept, zero work" to "revive cheaper — needs an explicit reversal of `998fdac`".
  The acceptance criteria even name the doc (`high-level-plan.md` §Sizing) and the test
  (`vicinityGraph.e2e.ts:177`) that must change if the answer is yes. This is above bar.
- **S4** `nid_c5acy7gm7lj3afz0vtq79k8bx_e` — states root cause, the 80/20 tripwire design, a
  mutation-based acceptance criterion, *and* its own known limits (catches missing selectors, not
  missing text) so the next agent cannot overclaim. Correctly filed, not fixed here — implementing
  and mutation-verifying a tripwire is its own unit of work.
- **N1** — corrected in place in `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md:26-29` with a parenthetical
  that keeps the original wrong sentence visible and marks it corrected. Good; strictly stronger claim.

## 3. The rejected item (N2) — rationale is SOUND, rejection accepted ✅

Verified the load-bearing fact myself: `git show 998fdac^:src/view/NoteNode.tsx` lines 87-92 render
`<span className="vicinity-graph-node__breadcrumb">` **nested inside**
`<div className="vicinity-graph-node__title">`. So `toHaveText` at `:188` only catches a returning
breadcrumb *because of that nesting* — a revival rendering the prefix as a **sibling** of the title
leaves `:188` green and only `:177` red. The converse also holds, which the maker did not state but
which strengthens the case: a revival that nests the prefix in the title *without* the
`__breadcrumb` class leaves `:177` green and only `:188` red. Neither assertion subsumes the other;
they are genuinely complementary at ~1 ms. Keeping both is the right call. N2 was a preference, not
a defect, and rejecting it with a concrete failure mode is exactly the expected handling.

## 4. Independent gate re-run — all four green, all claims match ✅

| Gate | Maker claimed | I observed | Match |
|---|---|---|---|
| `npm test` | exit 0, 990 passed | exit 0, 990 passed / 74 files | ✅ |
| `npm run check` | exit 0 | exit 0 | ✅ |
| `npm run build` | exit 0 | exit 0 | ✅ |
| `npm run test:e2e` | exit 0, 78 passed / 1 skip | exit 0, 78 passed / 1 skip | ✅ |

Verbatim (`.tmp/rev-npm-test.log`, `.tmp/rev-e2e.log`):
```
 Test Files  74 passed (74)
      Tests  990 passed (990)
npm-test-exit=0
```
```
  -   9 e2e/externalVault.e2e.ts:53:1 › WHEN VICINITY_E2E_VAULT points at a vault THEN its graph renders and is screenshotted
  ✓  72 e2e/vicinityGraph.e2e.ts:177:1 › no node renders a folder-prefix breadcrumb (2ms)
  ✓  73 e2e/vicinityGraph.e2e.ts:188:1 › singleton-folder note shows its trimmed frontmatter title (4ms)
  1 skipped
  78 passed (54.3s)
e2e-exit=0
```
`check-exit=0`, `build-exit=0`.

**"Did not run" audit: 0** (`grep -c "did not run"` → `0`). No `✘` lines. The single skip is the
env-gated `externalVault.e2e.ts:53` (`VICINITY_E2E_VAULT` unset by design), not a serial-mode
casualty. `git status --porcelain` after `build` is **empty** — no `main.js`/`styles.css` drift.

## 5. New HACKs introduced by the iteration — none

The whole iteration is one test move + JSDoc + four doc/ticket edits. No `.skip`, no `try/catch`,
no regex/substring softening, no assertion tuned to force green, no silent fallback. `toHaveCount(0)`
and `toHaveText` both remain strict. `src/` untouched. Clean.

---

## 🚨 BLOCKING

**None.**

## ⚠️ SHOULD-FIX

**None.** (Nothing found rises above preference; the bar for a verification pass is a real defect.)

## 💡 NICE-TO-HAVE

### V1. The S4 tripwire ticket's acceptance criterion would false-positive on the very guard this branch just added

`_tickets/feature-removals-cannot-go-red-on-the-fast-gate-…md` — Acceptance Criteria: *"`npm test`
goes RED when a CSS class asserted anywhere under `e2e/` exists nowhere in `src/view/`."*
Taken literally, that fires on `.vicinity-graph-node__breadcrumb` at `e2e/vicinityGraph.e2e.ts:178`,
which is asserted **precisely because it must not exist in `src/`**. Whoever implements it would
hit this on day one and be tempted to delete the guard.

Suggested one-line ticket amendment (no code, no re-run): *"Exempt absence guards — a class
asserted only via `toHaveCount(0)` is expected to be missing from `src/view/`; the scan must skip
those (`e2e/vicinityGraph.e2e.ts:178` is the live example)."* Cheap now, prevents a wrong fix later.

### V2. No `_change_log/` entry for this branch yet

`git log f45082d..HEAD --name-only` shows no `_change_log/` file. Repo precedent (`5b3eb91`
*"…close the ticket and record the change log"*) records it at branch close, so this is almost
certainly a merge-step item for TOP_LEVEL_AGENT rather than an iteration miss — noting it only so
it is not forgotten.

## Opinion — the two coexisting ticket systems

**Reasonable as an interim, and the right 80/20 call.** Filing once via the `ticket` CLI (so
`ticket ls`/`ready` sees it) and cross-referencing from `docs-internal/tickets/` beats duplicating
content into two directories that will rot apart; the maker correctly declined to file a third
ticket about tickets. That said, `CLAUDE.md` points at `docs-internal/tickets/` while the CLI writes
`_tickets/`, and that divergence will keep costing every agent a decision — worth a human ruling on
which is authoritative, then a `CLAUDE.md` line. Not this branch's job.

## Documentation Updates Needed

None beyond V1 (a one-line amendment to an already-filed ticket). **No `CLAUDE.md` change** — apart
from the `_tickets/` vs `docs-internal/tickets/` question above, which needs a human ruling first.

---

## Readiness

**I signal READINESS TO SHIP.** B1 is fixed on the merits, not papered over, and the fix is backed
by a mutation experiment whose numbers I checked for internal consistency. The five accepted items
landed accurately and the one rejection is well-argued with evidence I independently confirmed.
Four gates green at HEAD with zero "did not run" and zero artifact drift. V1/V2 are follow-ups that
must not block the merge.
