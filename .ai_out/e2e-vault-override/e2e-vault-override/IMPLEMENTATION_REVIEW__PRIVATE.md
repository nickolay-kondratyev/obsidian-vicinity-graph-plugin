# IMPLEMENTATION REVIEW — private notes

## ROUND 1 (re-review of `3b42b81`, `57fd27b`) — READY

Verification technique worth reusing: I mutation-tested the S3 guard instead of reading
it. Dropped `e2e/zzScanProbe.ts` (`fs.unlinkSync(dir + "/note.md")`) into the tree, ran
`npx vitest run e2e/vaultTarget.test.ts` → failed with the offender listed; then deleted
the file and confirmed `git status --porcelain` empty. Second probe (named import +
`fs.promises.writeFile`) stayed green → that is the real residual, reported as a NIT.
Logs: `.tmp/rev2-probe.log`, `.tmp/rev2-probe2.log`, `.tmp/rev2-test.log`.

B1 airtightness argument (checked, not assumed): env is read in exactly one place
(`launch`), constructor is private, `spawnAndConnect` has two callers (`launch`
post-gate, `relaunch` which reuses the carried `vaultMode`), and the gate precedes
`prepareSandboxConfigDir` + `spawn`. `allowExternalVault?: true` (literal type) is a nice
touch — `false` is unrepresentable, so the flag cannot be "explicitly disabled" by
accident.

I deliberately did NOT re-litigate: the declined `run-e2e.sh` spec-filter default (I had
marked it optional and their rationale — don't silently change what `test:e2e` runs — is
sound), the declined graceful shutdown (shared path, green suite, documented), or the two
cosmetic NITs they left (`~` expansion, import-time scratch dir). Coordinator asked for no
new nitpick fronts and there was nothing load-bearing left.

Not re-run: the real e2e suite (needs a live Obsidian). Accepted the implementer's
round-1 numbers (71 passed / 1 skipped / 1 pre-existing gamma failure; scratch-vault run
1 passed with a clean working tree afterwards) — consistent with round 0 and with the
ticketed gamma failure predating the branch.

---

## ROUND 0 notes

## Evidence gathered (so a re-review doesn't redo it)

- Obsidian bundle available at `.tmp/obsidian/obsidian-1.12.7/resources/obsidian.asar`;
  grep the raw bytes with python (`re.finditer(rb'prototype\.setEnable', data)`) — no
  asar extraction needed.
- `setEnable(e)`: `localStorage.setItem("enable-plugin-"+this.app.appId, …)` then, when
  true, `enablePlugin(a)` for each `a` in `this.enabledPlugins`. NO vault write.
  → implementer's deviation claim VERIFIED TRUE.
- `enablePlugin(id, save=false)`: manifest lookup + `loadPlugin`. NO `enabledPlugins.add`,
  NO `requestSaveConfig`. `enablePluginAndSave` is the writer; `saveConfig` →
  `vault.writeConfigJson("community-plugins", …)`.
  → the WHY-NOT prose in vaultTarget.ts / obsidianHarness.ts / README is FALSE (S1).
- Gates re-run: `npm test` 73/979 green; `npm run check` green; `tsc -p e2e/tsconfig.json`
  green. Logs in `.tmp/rev-test.log`, `.tmp/rev-check.log`, `.tmp/rev-e2etsc.log`.
  Did NOT run `npm run test:e2e` (needs a real Obsidian launch; the implementer's logs and
  the pre-existing gamma ticket were accepted at face value — ticket last touched in
  `507a27a`, before this branch).

## Reasoning on severity calls

- B1 was the judgement call. Arguments for blocking: the ticket's entire purpose is
  "don't mutate a real vault"; criterion 3 says "or otherwise mutated"; the exploration
  itself flagged spec incompatibility (§7.8) and it went unaddressed; the failure mode is
  silent (a user with the var exported in their shell running the suite loses their
  vicinity-graph settings). Arguments against: README does tell you to pass the spec
  filter. I kept BLOCKING because the safety property is supposed to be structural, and
  here it rests on the human typing the right argument — exactly the "by convention, not
  by construction" thing D1 was written to avoid. Fix is ~15 lines + one test.
- S3: resisted calling the guard "tautological" — it is a real scan and would catch the
  obvious regression (writing through `target.vaultDir`). Its weakness is the closed
  enumeration of 4 mutator names, which is a genuine hole, not a nitpick.
- Did not flag: DRY of the duplicated `.tmp/e2e/vault` literal (deliberate + asserted),
  `page.evaluate` `any` typing (pre-existing convention), the `test.skip` pattern in
  `externalVault.e2e.ts` (correct), or the `mode: "serial"` on a single-test file.

## If the implementer pushes back

- On S1: point at the two decompiled function bodies quoted in the PUBLIC file. The
  behaviour need not change — only the recorded reason.
- On B1: an acceptable alternative to `allowExternalVault` is a per-spec
  `test.skip(process.env.VICINITY_E2E_VAULT !== undefined, …)` in the other nine specs,
  but that is 9 edits and easy to forget on spec #11 — the harness-side refusal is the
  structural version and is what I'd hold out for.
