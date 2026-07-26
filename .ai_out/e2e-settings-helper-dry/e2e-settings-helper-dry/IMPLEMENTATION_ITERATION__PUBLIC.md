# IMPLEMENTATION_ITERATION__PUBLIC — round 1

Reviewer verdict was **READY, 0 blocking**. One ⚠️ IMPORTANT item, four NITs
explicitly marked "no iteration required". Net change this round: **one line**.

---

## ⚠️ IMPORTANT — `settingsUxVisual.e2e.ts:265`

**INCORPORATED.**

`await harness.saveGlobalView({ nodeCap: 42 })` → `await harness.setGlobalNodeCap(42)`.

The brief warned this might not be a blind swap, so I verified before touching it.
`ObsidianHarness.setGlobalNodeCap` (`e2e/obsidianHarness.ts:427-429`) is a pure
one-line delegation:

```ts
async setGlobalNodeCap(nodeCap: number): Promise<void> {
	await this.saveGlobalView({ nodeCap });
}
```

No `refreshOpenViews()`, no store re-read, no wait, no settings-tab redisplay —
nothing beyond the identical `saveGlobalView` call. (Contrast
`setNodePreviewPreference`, which *does* add `refreshOpenViews()`, and
`setMaxNodeSizePx`, which *does* add a `readGlobalView()` first — either of those
would have made the analogous swap behavior-changing. This one does not.)

So the serial spec's left-behind state is bit-identical to before: the test still
persists `nodeCap: 42`, still resets it to 100 via the Performance card, and the
following test still sees `depths.outgoingDepth === 4`. Nothing was reordered,
weakened, or re-scoped to make the swap fit. Confirmed empirically by the e2e
re-run below (`settingsUxVisual` still 16/16).

---

## 💡 NITs — evaluated, all four REJECTED

1. **`settingsUxVisual.e2e.ts:184-185` — the `toHaveCount(SETTINGS_TAB_SECTIONS.length)`
   that can no longer fail independently.** REJECTED (kept as-is).
   The test is literally named "renders one framed card per section"; the count IS
   its stated behavior. Deleting it would make the test's own subject implicit in a
   page-object wait two files away, trading a clear assertion for a shorter body.
   Coverage is unchanged either way — the reviewer's own point — so the only thing
   at stake is which line reports the failure, and the assertion reports it better
   than a timeout inside `open()`.

2. **`ViewSettingsOverride` borrowed as the patch type.** REJECTED.
   It is structurally exact (`Partial<ViewSettings>`) and it is the engine's real
   exported type. The alternatives are a local alias (a second name for one type —
   the opposite of the DRY chore just completed) or renaming the engine type
   (production-code churn for a test-harness readability nit). The doc comment on
   `saveGlobalView` already states the shallow-merge contract, which is the part a
   reader can actually get wrong. Not worth a type.

3. **Body-class theming durability.** REJECTED (not pre-empted).
   This property predates the change; nothing in the current suite re-applies
   Obsidian's configured theme mid-file. Adding a `body.theme-dark` assertion now
   would be a guard against a hypothetical, and it would sit in the page object's
   screenshot step where it has nothing to do with what is being photographed.
   The reviewer's remedy is recorded and correct *if it ever bites* — that is the
   right time to spend it. (If it ever does bite, the symptom is loud: a screenshot
   named `-dark` that is visibly light.)

4. **`SettingsTabPage.openModals()` living on the settings page object.** REJECTED —
   the reviewer already concluded "fine as is" and I agree; `confirmDialog()` is
   built on it and the doc comment says so.

---

## Gate results (honest, actually executed this round)

| Gate | Observed |
|---|---|
| `npm run check` | **exit 0** |
| `npm test` | **74 files, 990 tests passed**, exit 0 |
| `npm run test:e2e` (real Obsidian) | **79 passed, 1 skipped, exit 0** (51.5s) |

The e2e run was **required** (an `*.e2e.ts` was touched) and was run — it was not
skipped or assumed. Result matches the pre-change baseline exactly
(79 passed / 1 skipped / exit 0). Nothing was flaky. The 1 skipped test is
`externalVault.e2e.ts`, which self-skips without `VICINITY_E2E_VAULT`; unchanged
by this work.

Logs: `.tmp/iter-check.log`, `.tmp/iter-vitest.log`, `.tmp/iter-e2e.log`.

---

## Nothing else changed

No source file other than the single line in `e2e/settingsUxVisual.e2e.ts` was
modified this round. No new helper, no doc rewrite, no opportunistic cleanup —
this is the tail end of a DRY chore and it stays that size.
