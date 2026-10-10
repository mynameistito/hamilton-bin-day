import { describe, expect, it } from "vitest";

import type { ArcGisFeature } from "@/arcgis/client";
import { transformFeatures } from "@/dataset/transform";

const feature = (
  objectId: number,
  address: string | null,
  day: string | null,
  area: string | null
): ArcGisFeature => ({
  attributes: {
    OBJECTID: objectId,
    Parcel_Street_Address: address,
    RubbishRecycling_Area_Day: day,
    RubbishRecycling_Area_Type: area,
  },
});

describe(transformFeatures, () => {
  it("normalizes, sorts, and de-duplicates address schedules", () => {
    const result = transformFeatures([
      feature(1, "  12 Grey Street ", "Monday", "Area 1"),
      feature(2, "12 Grey Street", "Monday", "Area 1"),
      feature(3, "12 Grey Street", "Not Serviced", "Area 2"),
    ]);

    expect(result.records).toStrictEqual([
      {
        address: "12 Grey Street",
        area: "Area 1",
        dayOfWeek: 1,
        serviceStatus: "scheduled",
      },
      {
        address: "12 Grey Street",
        area: "Area 2",
        dayOfWeek: null,
        serviceStatus: "not_serviced",
      },
    ]);
    expect(result.duplicateCount).toBe(1);
    expect(result.conflictingAddresses).toBe(1);
  });

  it("reports excluded records and rejects unknown collection days", () => {
    const result = transformFeatures([
      feature(1, null, "Monday", "Area 1"),
      feature(2, "12 Grey Street", null, "Area 1"),
      feature(3, "12 Grey Street", "Monday", null),
      feature(4, "12 Grey Street", "Monday", "Area 3"),
      feature(5, "12 Grey Street", "Saturday", "Area 1"),
    ]);

    expect(result.records).toStrictEqual([]);
    expect(result.skipped).toStrictEqual({
      missingAddress: 1,
      missingArea: 1,
      missingDay: 1,
      unsupportedArea: 1,
    });
    expect(result.invalidDays).toStrictEqual(["saturday"]);
  });
});
