# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket `nid_x6l6x07rd1d1h4cefqmnyrbec_e` — "Settings tab: debounce numeric/text writes and validate bounds".
Branch `settings-debounce-validation`, commits `b821d48` (code + tests) and `11c352b` (README + tickets).

**`npm test`: 1038 passed / 78 files. `npm run check`: clean (src + e2e).** Nothing skipped, nothing masked.

## What changed

Two NEW pure view modules hold all the logic; `VicinityGraphSettingTab.ts` stays thin glue that renders
their verdict and wires the debouncer. No Obsidian DOM fake was built (none exists in this repo, and
building one was not the simplest path).

| File | Change |
|------|--------|
| `src/view/settingsDebounce.ts` (new) | `DebounceScheduler` seam + `WINDOW_DEBOUNCE_SCHEDULER` + `DebouncedSettingsWrites` (latest-wins per field, one shared settle window, `schedule`/`drop`/`flush`, serialized drain) |
| `src/view/settingsValidation.ts` (new) | `describeSizingRejection` (cross-field `maxPx >= minPx`), `invalidExclusionPatterns` → `{lineNumber, pattern, reason}[]`, `describeInvalidExclusionPatterns`, and `parseExclusionPatterns` MOVED here from the tab |
| `src/view/VicinityGraphSettingTab.ts` | every `addText`/`addTextArea` row now validates immediately and persists debounced; `hide()` + blur flush; per-row inline feedback slot |
| `src/view/constants.ts` | `SETTINGS_WRITE_DEBOUNCE_MS = 400` (named, with WHY, beside `REBUILD_DEBOUNCE_MS`) |
| `src/view/settings-tab.css` | `.vicinity-graph-settings-error` — hidden via `:empty`, no JS visibility state |
| `src/view/settingsWritePlan.test.ts` | +3 upper-bound pins |
| `README.md` | settle window + rejected values + invalid-regex feedback (was: "silently ignored") |

## Per acceptance criterion

**1. Numeric/text settings debounce before persisting + rebuilding.** All six typed controls
(exclusion textarea, each metric weight, minPx, maxPx, depthDecayK, node cap) route through
`DebouncedSettingsWrites` keyed by the row's visible name. A burst on one field costs ONE
persist + `refreshOpenViews()` rebuild.
- Callers pass a **thunk**, never a precomputed command, so globals are read fresh at flush time — the
  `writeContext()` "successive edits compose" invariant survives, and two fields edited inside one
  window merge instead of clobbering.
- **No edit is lost**: pending writes flush on field `blur` and on `hide()` (tab closed / navigated
  away). A half-typed or cleared field `drop()`s its own pending write so the burst's earlier
  keystrokes cannot persist behind the user's back.

**2. `maxPx < minPx` rejected with visible feedback.** `describeSizingRejection` refuses the pair;
the tab shows `Not applied: maximum node size (40px) must be at least the minimum (200px).` under the
row, sets `aria-invalid` on the input, and does not schedule the write. The typed text **stays in the
field** — not silently persisted, not silently reverted. Equal values are allowed (a legitimate
"all nodes the same size" config). It is also evaluated on open, so an inverted pair already in
`data.json` is called out.

**3. Upper bounds for sizing px and decay-k.** Already present in `SETTINGS_SPEC` (`minPx`/`maxPx`
max 400, `depthDecayK` max 10) as the exploration found — **not re-added**; pinned instead by three
behavior tests proving they still BITE through the write path.

**4. Invalid regex lines surfaced.** Per line, 1-based as the user sees it (blank lines counted):
`Line 2: "[unclosed" is not a valid regular expression — ignored.`, with the regex engine's own
message on hover. Shown on open as well as on typing.
- Invalid lines are surfaced but **still persisted** — the engine already skips them
  (`PathExclusionMatcher`), and refusing the write would discard the VALID lines typed in the same
  edit. Deliberate, and stated in the code.

**5. BDD tests.** All `WHEN … THEN …`, one behavior each.
- `src/view/settingsDebounce.test.ts` (12): keystrokes inside the window write nothing; a burst writes
  only the LAST value; two fields in one window both write in edit order; flush before the window
  still lands the write; the window after a flush does not repeat it; flushing nothing writes nothing;
  a rejected write does not wedge the next one; `drop` forgets one field and leaves the other.
  Driven by a `FakeDebounceScheduler` implementing the injected seam — deterministic, no global faking.
- `src/view/settingsValidation.test.ts` (12): inverted / equal / normal sizing pairs; invalid line
  reported with line number + pattern; line numbering counts blank lines; the engine reason is
  carried; all-valid reports nothing; two invalid lines both listed; parse trims and drops blanks and
  keeps invalid lines.
- `src/view/settingsWritePlan.test.ts` (+3): minPx / maxPx / depthDecayK capped at their spec max.

## Deferred / rejected (with rationale) — tickets filed, nothing silently patched

- **Engine-level `maxPx >= minPx`** — `clampSizingSettings` still clamps the two independently, so a
  hand-edited `data.json` (and the in-view `SizingSection.tsx` mirror) can still produce an inverted
  pair. Choosing HOW to resolve an inversion (swap / raise max / lower min / both defaults) is a
  user-visible semantics call with no precedent → `nid_9jiira82snkh7bgy8zv060c9r_e` **[decide]**.
- **`nodeCap` upper bound** — out of scope per TOP_LEVEL; needs `MinBoundedNumberSpec` →
  `BoundedNumberSpec` and a product call on the ceiling → `nid_aau4r0sj8oudhi711qr9j5x1l_e` **[decide]**.
- **Sliders left un-debounced.** The ticket scopes number/text/textarea; a prior reviewer explicitly
  deferred slider debounce as a watch item, and routing a drag through a 400 ms window changes its
  feel — an unrequested behavior change. Nothing blocks it later: sliders would just call
  `this.debounced.schedule(name, …)` like every other row.
- **e2e coverage** — no Playwright spec has ever typed into a settings input (confirmed by the
  exploration), so the tab WIRING is unit-tested only, not verified in a real Obsidian →
  `nid_ek3wrqoh1rsftk6ulg836mghf_e`.
- **Closed as superseded**: `nid_9uu8wncncsj8l59bq17y4gujy_e` (exclusion textarea debounce +
  invalid-regex feedback) — a strict subset of this work, with a note pointing at the new modules.

## How to verify

```bash
npm test        # 1038 passed
npm run check   # tsc strict, src + e2e
```
Manually (dev vault): open Settings → Vicinity Graph, type `160` into *Maximum node size* — the graph
rebuilds once, ~0.4 s after the last digit. Type `10` while the minimum is `40` — a red line appears
under the row, the field keeps `10`, nothing persists; fix it and the line clears. Paste `[unclosed`
as a second exclusion line — line 2 is named under the box while line 1 keeps working.
