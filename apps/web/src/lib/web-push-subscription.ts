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
/** JSON-compatible data accepted at the subscription parsing boundary. */
export type WebPushSubscriptionInput =
  | undefined
  | string
  | number
  | boolean
  | null
  | readonly unknown[]
  | {
      readonly endpoint?: unknown;
      readonly expirationTime?: unknown;
      readonly keys?:
        | {
            readonly auth?: unknown;
            readonly p256dh?: unknown;
          }
        | null
        | undefined;
    };

const decodeWebPushSubscription = decodeUnknownSync(WebPushSubscriptionSchema);

/** Parse an untrusted serialized push subscription into the application contract.
 * @param untrustedInput - JSON-compatible data received from browser or network input.
 * @returns The validated subscription, or `null` when validation fails.
 */
export const parseWebPushSubscription = (
  untrustedInput: WebPushSubscriptionInput
): WebPushSubscription | null => {
  try {
    return decodeWebPushSubscription(untrustedInput);
  } catch {
    return null;
  }
};
