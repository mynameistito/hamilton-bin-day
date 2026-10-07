# @hamilton-bin-day/cli

TypeScript client and CLI for Hamilton City Council's public Fight the Landfill bin-day API.

```bash
npx @hamilton-bin-day/cli --version
npx @hamilton-bin-day/cli search "12 Grey Street"
npx @hamilton-bin-day/cli lookup "12 Grey Street"
npx @hamilton-bin-day/cli schedule "12 Grey Street" --text
npx @hamilton-bin-day/cli --json lookup "12 Grey Street"
```

JSON is the default output; pass `--text` (or `--pretty`) for readable text. Address lookup uses the council endpoint at `https://api2.hcc.govt.nz`.

Use `--version` (or `-v`) to print the installed package version.

This is an unofficial community project, not affiliated with Hamilton City Council. API behavior and collection data may change without notice.

Install globally with `npm install --global @hamilton-bin-day/cli`; the installed executable is `hamilton-bin-day`.

See the [repository README](../../README.md) for workspace and development instructions.

The primary executable is `hamilton-bin-day`. The deprecated `hcc-bin-day` alias remains available for existing scripts; use `hamilton-bin-day` for new usage.
