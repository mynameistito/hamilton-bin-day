import type { NotificationPreferences } from "@/lib/notifications";
import type { ScheduleResponse } from "@/lib/schedule";
import type { WebPushSubscription } from "@/lib/web-push-subscription";

export const PUSH_ENDPOINT_STORAGE_KEY = "hamilton-bin-day-push-endpoint-v1";
const LEGACY_PUSH_ENDPOINT_STORAGE_KEY = "hcc-bin-day-push-endpoint-v1";

/** A queue that executes browser push mutations in the order they were submitted. */
export type PushMutationQueue = <T>(operation: () => Promise<T>) => Promise<T>;

/** Create a per-component queue that applies browser push mutations in call order.
 * @returns A queue that serializes operations and preserves their results.
 */
export const createPushMutationQueue = (): PushMutationQueue => {
  let tail = Promise.resolve(null);
  return async <T>(operation: () => Promise<T>): Promise<T> => {
    const previous = tail;
    const current = Promise.withResolvers<null>();
    tail = current.promise;
    await previous;
    try {
      return await operation();
    } finally {
      current.resolve(null);
    }
  };
};

const pushMutationQueue = createPushMutationQueue();

/** Serialize subscription mutations across reminder components in this tab.
 * @param operation - Mutation to run after prior mutations finish.
 * @returns The operation result.
 */
export const enqueuePushMutation: PushMutationQueue = (operation) =>
  pushMutationQueue(operation);

/** Read the last endpoint locally so server cleanup still works if PushManager loses it.
 * @returns The stored endpoint, or `null` if unavailable.
 */
export const readStoredPushEndpoint = (): string | null => {
  try {
    const current = window.localStorage.getItem(PUSH_ENDPOINT_STORAGE_KEY);
    if (current !== null) {
      window.localStorage.removeItem(LEGACY_PUSH_ENDPOINT_STORAGE_KEY);
      return current;
    }
    const legacy = window.localStorage.getItem(
      LEGACY_PUSH_ENDPOINT_STORAGE_KEY
    );
    if (legacy !== null) {
      window.localStorage.setItem(PUSH_ENDPOINT_STORAGE_KEY, legacy);
      window.localStorage.removeItem(LEGACY_PUSH_ENDPOINT_STORAGE_KEY);
    }
    return legacy;
  } catch {
    return null;
  }
};

/** Keep the opaque push endpoint in this browser only for later unsubscribe requests.
 * @param endpoint - Endpoint to retain locally.
 * @returns Whether local storage accepted the value.
 */
export const rememberPushEndpoint = (endpoint: string): boolean => {
  try {
    window.localStorage.setItem(PUSH_ENDPOINT_STORAGE_KEY, endpoint);
    window.localStorage.removeItem(LEGACY_PUSH_ENDPOINT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
};

/** Forget the locally retained endpoint after server-side deletion succeeds.
 * @returns Whether local storage accepted the removal.
 */
export const forgetPushEndpoint = (): boolean => {
  try {
    window.localStorage.removeItem(PUSH_ENDPOINT_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_PUSH_ENDPOINT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
};

/** Convert a VAPID base64url public key to the bytes expected by PushManager.
 * @param value - Unpadded base64url public key.
 * @returns Decoded uncompressed P-256 public key bytes.
 */
export const decodeApplicationServerKey = (
  value: string
): Uint8Array<ArrayBuffer> => {
  if (!/^[A-Za-z0-9_-]{87}$/u.test(value)) {
    throw new Error("Invalid VAPID public key");
  }
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  );
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) ?? 0;
  }
  if (bytes.byteLength !== 65 || bytes[0] !== 4) {
    throw new Error("Invalid VAPID public key");
  }
  return bytes;
};

type ReminderSchedule = Pick<ScheduleResponse, "redBin" | "yellowBin"> & {
  readonly nextCollection: Pick<
    ScheduleResponse["nextCollection"],
    "date" | "type"
  >;
};

const snapshotFor = (schedule: ReminderSchedule) => ({
  collectionDate: schedule.nextCollection.date,
  followingDate:
    schedule.nextCollection.type === "red"
      ? schedule.yellowBin
      : schedule.redBin,
  collectionType: schedule.nextCollection.type,
  redDate: schedule.redBin,
  yellowDate: schedule.yellowBin,
});

/** Persist a push subscription and the minimum schedule/preference snapshot needed by the sender.
 * @param subscription - Validated browser push subscription.
 * @param schedule - Collection schedule snapshot.
 * @param preferences - Reminder settings to persist.
 * @param timeZone - IANA timezone for delivery scheduling.
 * @param fetcher - Request implementation used to contact the API.
 * @returns Whether the server accepted the subscription.
 */
export const savePushReminder = async (
  subscription: WebPushSubscription,
  schedule: ReminderSchedule,
  preferences: NotificationPreferences,
  timeZone: string,
  fetcher: typeof fetch = fetch
): Promise<boolean> => {
  try {
    const response = await fetcher("/api/reminders/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription,
        schedule: snapshotFor(schedule),
        preferences: { ...preferences, enabled: true },
        timeZone,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

/** Delete server-side subscription data before the browser subscription is removed.
 * @param endpoint - Push endpoint credential identifying the record.
 * @param fetcher - Request implementation used to contact the API.
 * @returns Whether the server confirmed deletion.
 */
export const deletePushReminder = async (
  endpoint: string,
  fetcher: typeof fetch = fetch
): Promise<boolean> => {
  try {
    const response = await fetcher("/api/reminders/subscription", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${endpoint}` },
    });
    return response.ok;
  } catch {
    return false;
  }
};
