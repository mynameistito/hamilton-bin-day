---
"@mynameistito/hcc-bin-day": patch
---

Refactor the CLI's HCC API boundary around typed transport, HTTP, response-decoding, and schedule-construction errors. Report recognized API failures with a non-zero exit status while rethrowing unexpected defects, and source `--version` from workspace package metadata. This patch also includes CLI lint/TypeScript cleanup and expanded API error-path coverage; the address changes are test-fixture updates for normalized lookup inputs.
