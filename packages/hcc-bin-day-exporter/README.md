# HCC bin-day exporter

This private workspace package downloads the Hamilton City Council ArcGIS property layer and writes a compact address dataset with the current NZ collection week and area-level red/yellow rotation.

Run it from the repository root:

```sh
bun run bins:export
```

The generated `hcc-bin-days.json` is written beside this package. The export validates the complete ArcGIS OBJECTID list before writing. It records the week and color by area once in top-level metadata rather than duplicating bin color on every address.

The fortnight reference is 2026-10-05: Area 1 is yellow and Area 2 is red. The mapping was checked against HCC's live ArcGIS address areas and collection-date API. Week and DST calculations use `Pacific/Auckland`.
