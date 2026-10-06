# @mynameistito/hcc-bin-day

## 0.1.8

### Patch Changes

- 1acaebe: Refactor the CLI's HCC API boundary around typed transport, HTTP, response-decoding, and schedule-construction errors. Report recognized API failures with a non-zero exit status while rethrowing unexpected defects, and source `--version` from workspace package metadata. This patch also includes CLI lint/TypeScript cleanup and expanded API error-path coverage; the address changes are test-fixture updates for normalized lookup inputs.
- aaf79b7: Fix TypeScript path alias resolution for CLI test files.

## 0.1.7

### Patch Changes

- 35bc134: Use path aliases for internal imports and enforce the convention with Oxlint.
- 645bc49: Add package publishing metadata and run checks before packing the CLI.
- a7290e5: Run workspace tests with coverage by default and expand coverage for API failure paths.
- cc9b34e: Migrate the CLI to stable Effect 4.
- 83a7661: Add `--version` and `-v` flags to print the installed CLI package version.

## 0.1.6

### Patch Changes

- 5000e7c: Use the Fetch HTTP client so the CLI runs in both Node.js and Bun.

## 0.1.5

### Patch Changes

- 42158cd: Move the CLI runtime to Effect 4 and update its HTTP client dependencies.
