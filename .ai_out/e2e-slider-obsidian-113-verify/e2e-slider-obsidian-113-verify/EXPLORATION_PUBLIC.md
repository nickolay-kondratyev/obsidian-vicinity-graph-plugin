# EXPLORATION_PUBLIC — e2e-slider-obsidian-113-verify

Findings from the EXPLORE pass (read-only agent; recorded here by TOP_LEVEL_AGENT because that
agent has no write capability).

## 1. The test under discussion

`e2e/settingsUxVisual.e2e.ts:420-446` — `settings tab: WHEN a slider is hovered THEN its
current value is readable`.

Shape: a Playwright locator **union**

```
<body-level ".tooltip">            // Obsidian <= 1.12.x, via setDynamicTooltip()
  .or(
row.locator(".setting-item-control").getByText(value, { exact: true })   // documented 1.13 inline
  ).first()
```

asserted with a single `toBeVisible()` **after** hovering the slider.

WHY block at `e2e/settingsUxVisual.e2e.ts:399-419` names the two-mechanism risk.

### The diagnostic problem (this is the actionable finding)

On failure this is **one** `toBeVisible()` timeout. Playwright prints both sub-locators but
says nothing about *which* arm failed or *why*. Verified verbatim against the prior flow's
teeth-probe: `.ai_out/e2e-slider-value-readout/e2e-slider-value-readout/IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md:76-80`.

Consequence: when the pin eventually moves to 1.13, a red here is **indistinguishable** from a
product regression without manual investigation. The WHY block is the only clue, and it names
the risk rather than diagnosing the failure. This is exactly the confusing-RED the ticket
predicts — and it is fixable **today**, without a 1.13 build.

## 2. Helper involved

`e2e/settingsTabPage.ts:32-39` — `SettingsTabPage.open()`. (Product of the recent
`e2e-settings-helper-dry` work.) No other helper participates in this assertion.

## 3. Production side

`src/view/VicinityGraphSettingTab.ts:456-471` — WHY doc for `addLabeledSlider`'s
`setDynamicTooltip()`; its stated removal condition is `minAppVersion` reaching 1.13.0.

`manifest.json` → `minAppVersion: "1.12.4"`.

**Verdict: `setDynamicTooltip()` MUST STAY.** Its removal condition cannot be met — 1.13 is not
GA (see TOP_LEVEL_AGENT.md evidence table), so `minAppVersion` cannot responsibly move to
1.13.0. This half of the ticket is answerable now and the answer is "no change".

## 4. The entire evidentiary basis for the inline arm

`node_modules/obsidian/obsidian.d.ts:6772`:

> `@deprecated The value is now always shown inline next to the slider.`

That single sentence is **all** the inline arm was written from. It specifies **no selector,
no DOM ancestry, and no number formatting** — so the two concrete risks the ticket lists
(value rendered OUTSIDE `.setting-item-control`; formatting differing from `input.value`)
are both entirely unconstrained by the documentation. The inline arm is a well-reasoned guess,
and should keep being labelled as one.

## 5. Repo-wide 1.13 coupling

Grep for `1.13` / `minAppVersion` / `setDynamicTooltip`: no production or test code references
1.13 beyond `_tickets/*`, `.ai_out/*`, `_change_log/*`, and `package-lock.json` (typings
1.13.1). Nothing else needs to move in lockstep.

## 6. Harness runnability

Only `.tmp/obsidian/obsidian-1.12.7` is cached and runnable; `scripts/run-e2e.sh` and
`scripts/setup-obsidian-bin.sh` pin to it. e2e CAN run here — but only against 1.12.7, which
exercises the `.tooltip` arm exclusively (the status quo the ticket already documents).

## 7. Prior flow

`.ai_out/e2e-slider-value-readout/...` — the flow that wrote this test already knew the inline
arm was unobserved; that acknowledgement is what produced this ticket.

## Rejected approach (recorded so it is not re-attempted)

**Synthesising the 1.13 DOM** (inject a text node matching the guessed inline rendering, then
assert the inline locator finds it) would be **fake verification**: it tests the locator against
our own guess, not against Obsidian. A green would assert nothing about real 1.13 while looking
like the ticket was discharged. Per CLAUDE.md that is a lie-shaped test. Do not do it.
