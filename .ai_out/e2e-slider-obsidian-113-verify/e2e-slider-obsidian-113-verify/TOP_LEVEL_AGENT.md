# TOP_LEVEL_AGENT — e2e-slider-obsidian-113-verify

Ticket: `nid_zylnmqz76ftecuqpavnnu1byt_e` — "e2e: verify the slider value-readout test on an Obsidian >= 1.13 build".

## Blocking feasibility finding (established by TOP_LEVEL_AGENT, 2026-07-26)

The ticket's central instruction — bump `OBSIDIAN_VERSION` in `scripts/setup-obsidian-bin.sh`
to a 1.13.x build and run `npm run test:e2e` — **cannot be executed**: no such build is
obtainable.

Evidence (all commands run 2026-07-26 from this container):

| Probe | Result |
|---|---|
| `GET api.github.com/repos/obsidianmd/obsidian-releases/releases?per_page=40` | newest tag = **`v1.12.7`**; no 1.13.x tag exists |
| `HEAD .../releases/download/v1.13.1/obsidian-1.13.1.tar.gz` | **404** |
| `GET raw.githubusercontent.com/.../master/desktop-releases.json` | `latestVersion: "1.12.7"`; `beta.latestVersion: "1.13.3"`, `beta.downloadUrl: https://releases.obsidian.md/release/obsidian-1.13.3.asar.gz` |
| `HEAD https://releases.obsidian.md/release/obsidian-1.13.3.asar.gz` | **404** (insider/Catalyst-gated) |
| `HEAD https://releases.obsidian.md/release/obsidian-1.13.3.tar.gz` | **404** |

So: **1.13.x is insider-only** (paid Catalyst licence), distributed as an `.asar.gz` payload
rather than a runnable platform tarball. The npm `obsidian` typings resolve to **1.13.1**,
i.e. the typings ship ahead of the GA desktop app — which is precisely why the inline arm of
the test could be written from a `@deprecated` note that no shipped build yet demonstrates.

### Rejected workaround (recorded so it is not re-attempted)

Downloading the 1.12.7 platform tarball and swapping in a 1.13.3 `app.asar` is **not viable
and not attempted**: (a) the asar is licence-gated and 404s anyway; (b) even with it, running
a 1.13 payload inside a 1.12 Electron shell would not be a faithful "real 1.13 build", so a
green would not discharge the ticket's acceptance criterion; (c) it is a HACK per CLAUDE.md.

## Consequence for scope

Acceptance criterion ("passes on a pinned Obsidian >= 1.13.x build with the INLINE arm doing
the matching") is **BLOCKED on an external dependency**, not on engineering effort. The ticket
stays OPEN, annotated with this evidence and a precise re-check trigger.

Work that IS doable now, and is what this branch delivers:
1. Confirm `setDynamicTooltip()` must stay (its removal condition is `minAppVersion >= 1.13.0`,
   which cannot be reached while 1.13 is not GA).
2. Make a future 1.13 red **self-diagnosing** — so it reads as a test-locator problem, not a
   product regression. (Scoped after EXPLORATION reports on current failure diagnostics.)
3. Ticket + docs updated with the evidence above.

## Flow log

- [x] Feasibility probe (TOP_LEVEL_AGENT) — see table above.
- [x] Branch `e2e-slider-obsidian-113-verify` created off `main`.
- [x] EXPLORATION → `EXPLORATION_PUBLIC.md` (explorer is write-less; TOP_LEVEL_AGENT transcribed).
      Actionable finding: the union assertion fails as ONE opaque timeout — that IS the confusing
      RED the ticket predicts, and it is fixable without a 1.13 build.
- [x] IMPLEMENTATION_WITH_SELF_PLAN → commit `8d8fe32`.
- [x] IMPLEMENTATION_REVIEW → **VERDICT READY, 0 BLOCKING, 0 SHOULD-FIX**. Converged in ONE
      iteration; no IMPLEMENTATION_ITERATION round was needed. Reviewer independently re-ran
      check/test/e2e and re-ran the perturbation rather than trusting the maker's claims, and
      proved "assertion not weakened" mechanically (test body byte-identical to parent once
      try/catch scaffolding is removed).
- [x] Ticket annotated (stays OPEN — externally blocked) + change_log `hziud87mutz3tsq7iy8z1kvzt`.
- [x] Merged to `main`.

## Outcome

Ticket acceptance criterion **NOT met** — and cannot be met here. What shipped is the half of the
ticket that does not depend on a 1.13 build: the predicted confusing-RED is defused, and
`setDynamicTooltip()` is confirmed to stay. The ticket carries the evidence and a precise re-check
trigger for when 1.13 reaches GA.
