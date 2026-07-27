# IMPLEMENTATION_REVIEW — PUBLIC

Ticket `nid_6kms4zn8o8c8r7g983oqlvvky_e` — pin the `obsidian` devDependency to the supported floor instead of `latest`.
Branch `chore/pin-obsidian-typings`, reviewed at `621a490`.

## Summary

Three files change outside `.ai_out/`: `package.json` (`"obsidian": "latest"` → `"1.12.3"`), `package-lock.json`
(regenerated), and one appended bullet under **Guardrails** in `CLAUDE.md`. Nothing else. The change does what the
ticket asked, for the right reason, and I could not find a defect in it.

## Independently observed command results

I re-ran everything myself rather than trusting the implementation summary.

| Check | Observed |
|---|---|
| `npm run check` | **exit 0** — `tsc -noEmit` then `tsc -noEmit -p e2e/tsconfig.json`, both clean |
| `npm test` | **exit 0** — Test Files 81 passed (81), Tests 1094 passed (1094) |
| `node -p "require('./node_modules/obsidian/package.json').version"` | `1.12.3` |
| `npm ls obsidian` | `obsidian@1.12.3` at root; `obsidian-id-lib@0.1.0 → obsidian@1.12.3 deduped` — single resolved copy |
| `grep '1\.13\.' package-lock.json` | **no hits** — no leftover 1.13.1 version/resolved/integrity anywhere |
| `git status --porcelain` | clean apart from `.ai_out/` files |
| `git diff main...HEAD --name-only` (excl. `.ai_out/`) | `CLAUDE.md`, `package-lock.json`, `package.json` |

Lockfile coherence confirmed: the root `devDependencies` entry reads `1.12.3` **and** `node_modules/obsidian` records
`version 1.12.3`, `resolved .../obsidian-1.12.3.tgz`, and a matching new `integrity` hash. Both halves moved together.

## Finding-by-finding

### 1. Is `1.12.3` the right target? — **NON-ISSUE (verified correct)**

`npm view obsidian versions --json` observed directly. The published tail is
`… 1.12.0, 1.12.2, 1.12.3, 1.13.0, 1.13.1`. Neither `1.12.4` (the `manifest.json` floor) nor `1.12.7` (the e2e
`OBSIDIAN_VERSION`) is published — the typings package does not track app releases 1:1. `1.12.3` is therefore the
highest published version at-or-below the floor, and is the only defensible choice.

Hazard of pinning one patch *below* the floor (an API that exists on app 1.12.4 but is untyped in 1.12.3): checked and
does not materialize. `npm run check` is green across `src/` and `e2e/`, and `grep` for `as any` / `@ts-expect-error` /
`@ts-ignore` in non-test `src/` returns **zero hits** — so nothing was papered over to make the downgrade compile. The
direction is also the safe one: a missing typing fails loudly at compile time, whereas typings ahead of the floor fail
silently at runtime, which is exactly the bug this ticket exists to prevent.

### 2. Exactness of the pin — **NON-ISSUE (verified correct)**

`"obsidian": "1.12.3"` is an exact string, no `^`/`~`, so `npm install` cannot drift back to 1.13.x. No other
dependency in `package.json` uses `latest` or `*`.

`obsidian-id-lib`'s `peerDependencies: {"obsidian": "*"}` was assessed: a `*` peer *accepts* any version, it never
*requests* an upgrade, and `npm ls` confirms it deduped onto the root's 1.12.3. It cannot reintroduce this class of
bug.

### 3. The regression is actually prevented — **NON-ISSUE (verified correct)**

This is the point of the ticket and it holds. In the now-installed `node_modules/obsidian/obsidian.d.ts:5805`,
`setDynamicTooltip(): this;` carries only `@public` / `@since 0.9.7` — **no `@deprecated` tag**. The misleading tag is
no longer reachable from the editor or from `tsc`.

The revert is intact: `src/view/VicinityGraphSettingTab.ts:687` still calls `.setDynamicTooltip()` inside
`addLabeledSlider`, with a WHY block at lines 662–670 explaining the 1.13-vs-floor reasoning and pointing at the e2e
guard. The behavioural guard in `e2e/settingsUxVisual.e2e.ts` ("WHEN a slider is hovered THEN its current value is
readable") is present and unmodified. No behavior-capturing test was removed or weakened anywhere in this diff.

### 4. CLAUDE.md line quality — **NICE-TO-HAVE at most**

The added bullet:

> `obsidian` typings are pinned to the floor (`1.12.3`, nearest published npm version ≤ `minAppVersion` 1.12.4), never
> `latest` — a newer tag's `@deprecated` may describe an API still live on the floor, so verify against the pinned e2e
> build (1.12.7) before deleting a call.

It is ONE bullet, in the Guardrails section, in the surrounding imperative style, and it encodes all three parts of the
rule: track the floor not `latest`; `@deprecated` in newer typings ≠ dead on the floor; verify against the pinned e2e
build before deleting a call. Critically it *does* name the 1.12.3-vs-1.12.4 wrinkle, which is the single thing most
likely to confuse a future maintainer into "fixing" the mismatch.

It is the longest bullet in the section, so it brushes against CLAUDE.md's own "SUCCINCT" rule. I looked for a clause
to cut and could not find one that does not lose actionable content — the parenthetical is what stops the re-litigation,
and the `1.12.7` reference is what makes the verification step concrete. **Recommend keeping as-is.** Not a finding I
would hold the change for.

### 5. Scope discipline — **NON-ISSUE (verified)**

The non-`.ai_out/` diff is exactly the three expected files. `main.js` and `styles.css` are gitignored and untracked,
so the rebuild left nothing stray. The lockfile diff is **8 lines touching only the `obsidian` entries** — no
opportunistic bumps of unrelated packages, which is the usual failure mode of a `npm install`-regenerated lock. Clean.

### 6. Nothing missing elsewhere — **NON-ISSUE**

`scripts/setup-obsidian-bin.sh` (`OBSIDIAN_VERSION="1.12.7"`) and `manifest.json` (`minAppVersion: "1.12.4"`) were
correctly left alone: those numbers describe the *app*, the pin describes the *typings*, and they cannot be unified
because npm publishes no 1.12.4/1.12.7 typings. Changing either to match would be actively wrong. README needs no edit
— it documents user-facing settings, not the dev typings pin.

### 7. Durable mechanism gap — **NICE-TO-HAVE, explicitly NOT worth it**

Nothing mechanically stops someone re-adding `"latest"`. The implementation considered a unit test asserting the pinned
string and rejected it on 80/20. **I agree, and would reject it too.** Such a test asserts a literal against itself,
duplicates the lockfile, and fires on every legitimate future bump — while the regression that actually hurt users is
behavioural and is already covered by the e2e slider-readout assertion running against the pinned 1.12.7 binary. The
one-line `package.json` diff is also maximally visible in review. Guardrail + e2e test is the right coverage here.

## Observations that are not findings

- `src/view/VicinityGraphSettingTab.ts:662` opens with "WHY `setDynamicTooltip()` despite the `@deprecated` tag" —
  after this pin there is no such tag in the reader's editor. The very next clause says "the tag comes from the 1.13
  typings", so it is self-resolving, and the line is pre-existing (not in this diff). Mentioning only so it is not
  mistaken for drift later.
- `npm run test:e2e` was not run (real-Obsidian release gate, needs the downloaded binary). Justified: `obsidian` is
  `external` in esbuild and never bundled, so a compile-time typings pin cannot change runtime bundle contents. Worth
  running at the normal release gate, not as a condition of this change.
- The implementer's `.ai_out/IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` was still untracked/uncommitted at review time;
  I committed only my own review files.

## Severity roll-up

- 🚨 CRITICAL / BLOCKING: **none**
- ⚠️ IMPORTANT / SHOULD-FIX: **none**
- 💡 NICE-TO-HAVE: CLAUDE.md bullet length (recommend keeping as-is); optional wording tweak at
  `VicinityGraphSettingTab.ts:662`
- Documentation updates needed: **none beyond what the diff already does**

The change is correct, complete, minimal, and well-reasoned. Every claim in the implementation summary reproduced
exactly under independent execution.

VERDICT: READY
