---
id: nid_eep1kqfw25odv8intx4ddv1h7_e
title: "e2e settingsResetReview: section reset locator matches 3 sections (strict mode violation)"
status: open
deps: []
links: []
created_iso: 2026-08-01T05:05:05Z
status_updated_iso: 2026-08-01T05:05:05Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, test-infra]
---


## Notes

**2026-08-01T05:05:24Z**

## Symptom

`npm run test:e2e` FAILS (pre-existing on main; NOT caused by the drawer-resize work — reproduced with settings files untouched):

    e2e/settingsResetReview.e2e.ts:60 > REVIEW: isolation matrix - each section reset touches only its own keys
    Error: locator.click: strict mode violation:
      locator('.vicinity-graph-settings-section').filter({ hasText: 'Depth' })
        .locator('.vicinity-graph-settings-reset button') resolved to 3 elements:
        1) Restore depth defaults
        2) Restore node sizing defaults
        3) Restore node contents defaults

It aborts the run, so 10 further tests never execute (104 passed, 1 failed, 1 skipped).

## Root cause

`SettingsTabPage.card(headingText)` (e2e/settingsTabPage.ts:119) addresses a section
card with `hasText`, which is a case-insensitive SUBSTRING match over the card's whole
subtree — not a heading match. Two ROWS in other sections contain the word "depth":

- `settingsRows.ts` "Depth decay k" (Node sizing section)
- `settingsRows.ts` "Outline depth" (Node contents section)

so `card("Depth")` matches three cards. The locator has been latently wrong; it only
became a failure once those row labels existed (they predate this ticket).

## Fix direction

Scope the match to the card's HEADING, not its whole text, e.g. filter on a heading
locator with an exact match:

    card(headingText) {
      return this.page.locator(".vicinity-graph-settings-section")
        .filter({ has: this.page.getByRole("heading", { name: headingText, exact: true }) });
    }

Then the reset button is unambiguous. Verify by re-running the previously-aborted
tests, not just this one. Prefer fixing the shared page object over per-call
disambiguation — every future section-scoped assertion inherits the same trap.

## Why it matters now

CLAUDE.md was just changed (same session) to make `npm run test:e2e` a DEVELOPMENT
gate, not release-only. A suite that aborts on a stale locator makes that policy
unusable, so this should be fixed before the policy has teeth.
