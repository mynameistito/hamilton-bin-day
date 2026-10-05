import {
  Literals,
  Number as SchemaNumber,
  TaggedError as makeTaggedError,
  Unknown,
  optional,
} from "effect/Schema";

/** Errors raised while communicating with or decoding the council API. */
export class HccApiError extends makeTaggedError<HccApiError>()("HccApiError", {
  cause: Unknown,
  operation: Literals(["searchAddresses", "getCollectionSchedule"]),
  reason: Literals(["transport", "http", "decode", "domain"]),
  status: optional(SchemaNumber),
}) {}
