# hamilton-bin-day

TypeScript client and CLI for Hamilton City Council's public Fight the Landfill bin-day API.

```bash
npx hamilton-bin-day --version
npx hamilton-bin-day search "12 Grey Street"
npx hamilton-bin-day lookup "12 Grey Street"
npx hamilton-bin-day schedule "12 Grey Street" --text
npx hamilton-bin-day --json lookup "12 Grey Street"
```

JSON is the default output; pass `--text` (or `--pretty`) for readable text. Address lookup uses the council endpoint at `https://api2.hcc.govt.nz`.

Use `--version` (or `-v`) to print the installed package version.

This is an unofficial community project, not affiliated with Hamilton City Council. API behavior and collection data may change without notice.

See the [repository README](../../README.md) for workspace and development instructions.

The `hcc-bin-day` executable remains available as a compatibility alias.
