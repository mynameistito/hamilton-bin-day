/**
 * Typed failure raised when an ArcGIS request, response, or ArcGIS error
 * envelope cannot be handled successfully.
 */
export class ArcGisError extends Error {
  /** Stable tag identifying this failure in the Effect error channel. */
  readonly _tag = "ArcGisError" as const;

  /** Error name used by runtime diagnostics and stack traces. */
  override readonly name = "ArcGisError";
}
