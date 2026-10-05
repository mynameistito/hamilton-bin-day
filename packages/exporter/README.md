# HCC bin-day exporter

This private workspace package downloads the Hamilton City Council ArcGIS property layer and writes a compact address dataset with the current NZ collection week and area-level red/yellow rotation. Its HTTP, file-system, clock, logging, and failure handling use Effect, with Node platform adapters so it can run under Node.js.

Run it from the repository root:

```sh
bun run bins:export
```

Build the package, then run the emitted Node.js entrypoint directly:

```sh
bun run build
node dist/cli.mjs
```

Source modules are grouped by responsibility: `arcgis/` handles the external API, `dataset/` transforms source features, `exporter.ts` coordinates the Effect program, and `cli.ts` wires the Node runtime.

The generated `hcc-bin-days.json` is written beside this package. The export validates the complete ArcGIS OBJECTID list before writing. It records the week and color by area once in top-level metadata rather than duplicating bin color on every address.

The fortnight reference is 2026-10-05: Area 1 is yellow and Area 2 is red. The mapping was checked against HCC's live ArcGIS address areas and collection-date API. Week and DST calculations use `Pacific/Auckland`.
