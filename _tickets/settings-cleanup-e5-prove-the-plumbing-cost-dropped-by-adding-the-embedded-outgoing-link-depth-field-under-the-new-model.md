---
id: nid_d57npvuvjk95n03c2xqgl3y6o_e
title: "Settings cleanup E5: prove the plumbing cost dropped by adding the embedded-outgoing-link depth field under the new model"
status: open
deps: [nid_wimjq4ewgbg21n4zx9d4qq3a0_e, nid_armoson86j0ii8c33r1odo1rc_e]
links: [nid_fay1hu5sxcoygizopkkg0f0d7_e]
created_iso: 2026-07-29T17:30:12Z
status_updated_iso: 2026-07-29T17:30:12Z
type: epic
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [settings, dx]
---

Part of the settings cleanup approved by the owner on 2026-07-29. Depends on E1 (and ideally E3).

This is the MEASUREMENT step for the whole cleanup, not a feature ticket in disguise.

Implement nid_fay1hu5sxcoygizopkkg0f0d7_e (separate depth budget for embedded outgoing links -- research already done, owner decisions already settled) as the FIRST new settings field added under the declarative descriptor model.

ACCEPTANCE: record how many files and lines the new field actually cost, and compare against the pre-cleanup baseline of ~15 files / ~8 hand-maintained lists documented in nid_8p0nn2g34d97finokwlz3u1dt_e. If it is not dramatically cheaper, the descriptor design did not deliver and E1 should be revisited rather than declared done.

Be honest in the write-up -- a disappointing number here is the single most valuable signal this cleanup can produce.

