import {
  decodeUnknownSync,
  isMaxLength,
  isPattern,
  Null,
  Number as SchemaNumber,
  optional,
  String as SchemaString,
  Struct,
  Union,
} from "effect/Schema";

/** JSON representation of a browser PushSubscription used by the reminder API. */
const WebPushSubscriptionSchema = Struct({
  endpoint: SchemaString.check(isMaxLength(2048)).check(
    isPattern(/^https:\/\/\S+$/u)
  ),
  expirationTime: optional(Union([SchemaNumber, Null])),
  keys: Struct({
    auth: SchemaString.check(isPattern(/^[A-Za-z0-9_-]{22}$/u)),
    p256dh: SchemaString.check(isPattern(/^[A-Za-z0-9_-]{87}$/u)),
  }),
});

/** Application-owned serialized subscription shape shared by browser and Worker. */
export type WebPushSubscription = (typeof WebPushSubscriptionSchema)["Type"];

const decodeWebPushSubscription = decodeUnknownSync(WebPushSubscriptionSchema);

/** Parse an untrusted serialized push subscription into the application contract. */
export const parseWebPushSubscription = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- SAFETY: This parser consumes the unknown JSON boundary through the Effect Schema decoder below.
  value: unknown
): WebPushSubscription | null => {
  try {
    return decodeWebPushSubscription(value);
  } catch {
    return null;
  }
};
