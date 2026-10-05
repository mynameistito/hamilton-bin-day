/** A typed error raised by the ArcGIS export adapter. */
export class ArcGisError extends Error {
  /** Stable error tag for typed Effect error handling. */
  readonly _tag = "ArcGisError" as const;

  /** Identifies the adapter error in runtime diagnostics. */
  override readonly name = "ArcGisError";
}
