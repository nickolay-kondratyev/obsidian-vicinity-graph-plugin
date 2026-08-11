---
id: nid_6foww1s1ekufrnha1t4j08wnn_e
title: "we have moved the e2e into submodule and now github flow is failing"
status: open
deps: []
links: []
created_iso: 2026-08-11T13:40:52Z
status_updated_iso: 2026-08-11T13:40:52Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

github workflow is failing lets make sure github workflow is not failing
```
Run npm run check

> vicinity-graph@0.1.10 check
> tsc -noEmit && npm run check:e2e


> vicinity-graph@0.1.10 check:e2e
> tsc -noEmit -p e2e/tsconfig.json

error TS5058: The specified path does not exist: 'e2e/tsconfig.json'.
Error: Process completed with exit code 1.
```

We can also SIMPLIFY and just run e2e locally in release shell (release update tag script) and not run them in github.