import { z } from "zod";

import { calculateReminderSchedule } from "@/lib/notifications";
import type {
  NotificationPreferences,
  ReminderLeadDays,
} from "@/lib/notifications";
import { readVapidConfiguration, sendWebPush } from "@/lib/web-push";
import type { VapidConfiguration } from "@/lib/web-push";
import { parseWebPushSubscription } from "@/lib/web-push-subscription";
import type { WebPushSubscription } from "@/lib/web-push-subscription";

const isCalendarDate = (value: string): boolean => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};
const CollectionDate = z.iso.date().refine(isCalendarDate);
const SubscriptionRequest = z.strictObject({
  subscription: z.unknown(),
  schedule: z.strictObject({
    collectionDate: CollectionDate,
    followingDate: CollectionDate,
    collectionType: z.enum(["red", "yellow"]),
    redDate: CollectionDate,
    yellowDate: CollectionDate,
  }),
  preferences: z.strictObject({
    enabled: z.literal(true),
    leadDays: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(7)]),
    localTime: z.string().check(z.regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u)),
  }),
  timeZone: z.string().min(1).max(128),
});

interface D1Result {
  readonly meta?: { readonly changes?: number };
}

interface D1Statement {
  readonly bind: (
    ...values: readonly (string | number | null)[]
  ) => D1Statement;
  readonly first: <T>() => Promise<T | null>;
  readonly run: () => Promise<D1Result>;
  readonly all: <T>() => Promise<{ readonly results: readonly T[] }>;
}

/** The minimum D1 surface required by reminder routes and the scheduled sender. */
export interface ReminderDatabase {
  /** Prepare a parameterized SQL statement. */
  readonly prepare: (query: string) => D1Statement;
}

/** Cloudflare bindings used by the reminder API and sender. */
export interface ReminderEnvironment {
  /** D1 database containing only subscription and schedule reminder data. */
  readonly REMINDERS?: ReminderDatabase;
  /** VAPID public key; set with the corresponding private key before enabling delivery. */
  readonly VAPID_PUBLIC_KEY?: string;
  /** VAPID private key, provisioned as a Cloudflare Worker secret. */
  readonly VAPID_PRIVATE_KEY?: string;
  /** VAPID subject, for example a mailto: contact address. */
  readonly VAPID_SUBJECT?: string;
}

interface ReminderRecord {
  readonly endpoint: string;
  readonly subscription_json: string;
  readonly collection_date: string;
  readonly following_date: string;
  readonly collection_type: "red" | "yellow";
  readonly lead_days: ReminderLeadDays;
  readonly local_time: string;
  readonly time_zone: string;
  readonly scheduled_at: string;
  readonly notification_id: string;
  readonly claim_until: string | null;
  readonly revision: number;
}

const PUSH_SERVICE_SUFFIXES = [
  ".push.apple.com",
  ".notify.windows.com",
  ".push.services.mozilla.com",
] as const;
const validPushOrigin = (endpoint: string): boolean => {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.port || url.username || url.password) {
    return false;
  }
  const host = url.hostname.toLowerCase();
  const knownProvider =
    host === "fcm.googleapis.com" ||
    host === "updates.push.services.mozilla.com";
  return (
    knownProvider ||
    PUSH_SERVICE_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
};

const jsonError = (status: number, error: string): Response =>
  Response.json({ error }, { status });
const DELIVERY_UNAVAILABLE = "Reminder delivery is not configured";

/** Respond with a public key only when the complete VAPID configuration exists. */
export const handleReminderPublicKey = async (
  environment: ReminderEnvironment
): Promise<Response> => {
  const keys = await readVapidConfiguration(environment);
  return keys && environment.REMINDERS
    ? Response.json({ publicKey: keys.publicKey })
    : jsonError(503, DELIVERY_UNAVAILABLE);
};

const parseTimeZone = (value: string): string | null => {
  try {
    return new Intl.DateTimeFormat("en-NZ", {
      timeZone: value,
    }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
};

const HAMILTON_DATE_FORMATTER = new Intl.DateTimeFormat("en-NZ", {
  timeZone: "Pacific/Auckland",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const currentHamiltonDate = (now: Date): string => {
  const parts = new Map(
    HAMILTON_DATE_FORMATTER.formatToParts(now).map((part) => [
      part.type,
      part.value,
    ])
  );
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
};

const daysBetween = (left: string, right: string): number =>
  (Date.parse(`${right}T00:00:00.000Z`) - Date.parse(`${left}T00:00:00.000Z`)) /
  86_400_000;

const calendarDateInTimeZone = (date: Date, timeZone: string): string => {
  const parts = new Map(
    new Intl.DateTimeFormat("en-NZ", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
};

const bearerEndpoint = (request: Request): string | null => {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  const endpoint = authorization.slice("Bearer ".length);
  try {
    return validPushOrigin(endpoint) ? endpoint : null;
  } catch {
    return null;
  }
};

/** Check that a mutation request originates from this site's own origin. */
export const isSameOriginRequest = (request: Request): boolean => {
  const origin = request.headers.get("origin");
  return origin === null || origin === new URL(request.url).origin;
};

const MAX_SUBSCRIPTION_BODY_BYTES = 16 * 1024;

const readBoundedJson = async (
  request: Request
): Promise<ParsedSubscriptionRequest | null> => {
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim() !==
    "application/json"
  ) {
    return null;
  }
  const reader = request.body?.getReader();
  if (!reader) {
    return null;
  }
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- SAFETY: A stream reader must be consumed sequentially so each chunk is counted before buffering.
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    byteLength += value.byteLength;
    if (byteLength > MAX_SUBSCRIPTION_BODY_BYTES) {
      // oxlint-disable-next-line no-await-in-loop -- SAFETY: Cancel the active reader before rejecting an oversized request body.
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const parsed = SubscriptionRequest.safeParse(
    JSON.parse(new TextDecoder().decode(bytes))
  );
  if (!parsed.success) {
    return null;
  }
  const subscription = parseWebPushSubscription(parsed.data.subscription);
  return subscription ? { ...parsed.data, subscription } : null;
};

type ParsedSubscriptionRequest = Omit<
  z.infer<typeof SubscriptionRequest>,
  "subscription"
> & { readonly subscription: WebPushSubscription };

const parseRequest = async (request: Request, now: Date) => {
  try {
    const parsed = await readBoundedJson(request);
    if (!parsed || !validPushOrigin(parsed.subscription.endpoint)) {
      return null;
    }
    const timeZone = parseTimeZone(parsed.timeZone);
    const {
      collectionDate,
      followingDate,
      collectionType,
      redDate,
      yellowDate,
    } = parsed.schedule;
    const dateForType = collectionType === "red" ? redDate : yellowDate;
    const expectedFollowingDate =
      collectionType === "red" ? yellowDate : redDate;
    const today = currentHamiltonDate(now);
    const invalidSnapshot =
      collectionDate !== dateForType ||
      followingDate !== expectedFollowingDate ||
      daysBetween(collectionDate, followingDate) < 1 ||
      daysBetween(collectionDate, followingDate) > 14;
    const invalidHorizon =
      collectionDate < today || daysBetween(today, collectionDate) > 21;
    if (!timeZone || invalidSnapshot || invalidHorizon) {
      return null;
    }
    return { ...parsed, timeZone };
  } catch {
    return null;
  }
};

const scheduleFor = (
  collectionDate: string,
  leadDays: ReminderLeadDays,
  localTime: string,
  timeZone: string
) =>
  calculateReminderSchedule(
    collectionDate,
    { enabled: true, leadDays, localTime } satisfies NotificationPreferences,
    timeZone
  );

const collectionTypeAfter = (type: "red" | "yellow"): "red" | "yellow" =>
  type === "red" ? "yellow" : "red";

const advanceDate = (date: string, days: number): string => {
  const instant = new Date(`${date}T00:00:00.000Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
};

/** Create/update an opt-in subscription without receiving or retaining an address. */
export const handleReminderSubscribe = async (
  request: Request,
  environment: ReminderEnvironment,
  now = new Date()
): Promise<Response> => {
  if (!isSameOriginRequest(request)) {
    return jsonError(403, "Cross-origin reminder requests are not allowed");
  }
  const database = environment.REMINDERS;
  if (!database) {
    return jsonError(503, DELIVERY_UNAVAILABLE);
  }
  const keys = await readVapidConfiguration(environment);
  if (!keys) {
    return jsonError(503, DELIVERY_UNAVAILABLE);
  }
  const input = await parseRequest(request, now);
  if (!input) {
    return jsonError(400, "Invalid reminder subscription or schedule");
  }
  const pushSubscription = {
    ...input.subscription,
    expirationTime: input.subscription.expirationTime ?? null,
  } satisfies WebPushSubscription;
  const date = currentHamiltonDate(now);
  const deferWeeklyReminder =
    input.preferences.leadDays === 7 &&
    daysBetween(date, input.schedule.collectionDate) < 7;
  const collectionDate = deferWeeklyReminder
    ? input.schedule.followingDate
    : input.schedule.collectionDate;
  const followingDate = deferWeeklyReminder
    ? advanceDate(input.schedule.followingDate, 7)
    : input.schedule.followingDate;
  const collectionType = deferWeeklyReminder
    ? collectionTypeAfter(input.schedule.collectionType)
    : input.schedule.collectionType;
  if (collectionDate < date) {
    return jsonError(400, "Collection date is no longer current");
  }
  const reminder = scheduleFor(
    collectionDate,
    input.preferences.leadDays,
    input.preferences.localTime,
    input.timeZone
  );
  if (!reminder) {
    return jsonError(400, "Reminder time could not be resolved");
  }
  const nextDue = reminder.scheduledAt.getTime() <= now.getTime();
  const scheduledAt = nextDue
    ? now.toISOString()
    : reminder.scheduledAt.toISOString();
  const notificationId = `${collectionDate}:${input.preferences.leadDays}:${input.preferences.localTime}:${input.timeZone}`;
  try {
    await database
      .prepare(
        `INSERT INTO reminder_subscriptions
          (endpoint, subscription_json, collection_date, following_date, collection_type,
            lead_days, local_time, time_zone, scheduled_at, notification_id, claim_until,
             updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
          ON CONFLICT(endpoint) DO UPDATE SET
           subscription_json = excluded.subscription_json,
           collection_date = excluded.collection_date,
           following_date = excluded.following_date,
           collection_type = excluded.collection_type,
           lead_days = excluded.lead_days,
           local_time = excluded.local_time,
           time_zone = excluded.time_zone,
           scheduled_at = excluded.scheduled_at,
            notification_id = excluded.notification_id,
            claim_until = NULL,
            updated_at = excluded.updated_at,
            revision = reminder_subscriptions.revision + 1`
      )
      .bind(
        input.subscription.endpoint,
        JSON.stringify(pushSubscription),
        collectionDate,
        followingDate,
        collectionType,
        input.preferences.leadDays,
        input.preferences.localTime,
        input.timeZone,
        scheduledAt,
        notificationId,
        now.toISOString()
      )
      .run();
    return Response.json({ saved: true });
  } catch {
    return jsonError(503, "Reminder subscription could not be saved");
  }
};

/** Remove the subscription identified by its unguessable push endpoint. */
export const handleReminderUnsubscribe = async (
  request: Request,
  environment: ReminderEnvironment
): Promise<Response> => {
  if (!isSameOriginRequest(request)) {
    return jsonError(403, "Cross-origin reminder requests are not allowed");
  }
  const endpoint = bearerEndpoint(request);
  if (!endpoint) {
    return jsonError(401, "A valid subscription credential is required");
  }
  if (!environment.REMINDERS) {
    return jsonError(503, "Reminder storage is unavailable");
  }
  try {
    await environment.REMINDERS.prepare(
      "DELETE FROM reminder_subscriptions WHERE endpoint = ?"
    )
      .bind(endpoint)
      .run();
    return Response.json({ removed: true });
  } catch {
    return jsonError(503, "Reminder subscription could not be removed");
  }
};

const SUBSCRIPTION_ENDPOINT_SQL =
  "DELETE FROM reminder_subscriptions WHERE endpoint = ?";
const CLEAR_CLAIM_SQL =
  "UPDATE reminder_subscriptions SET claim_until = NULL WHERE endpoint = ? AND notification_id = ?";

const removeSubscription = async (
  database: ReminderDatabase,
  endpoint: string,
  revision?: number
): Promise<void> => {
  if (revision !== undefined) {
    await database
      .prepare(
        "DELETE FROM reminder_subscriptions WHERE endpoint = ? AND revision = ?"
      )
      .bind(endpoint, revision)
      .run();
    return;
  }
  await database.prepare(SUBSCRIPTION_ENDPOINT_SQL).bind(endpoint).run();
};

const releaseClaim = async (
  database: ReminderDatabase,
  record: ReminderRecord
): Promise<void> => {
  await database
    .prepare(CLEAR_CLAIM_SQL)
    .bind(record.endpoint, record.notification_id)
    .run();
};

const advanceSubscription = async (
  database: ReminderDatabase,
  record: ReminderRecord,
  now: Date,
  notBeforeDate?: string
): Promise<void> => {
  let nextDate = record.following_date;
  let nextFollowingDate = advanceDate(nextDate, 7);
  let nextType = collectionTypeAfter(record.collection_type);
  if (notBeforeDate && nextDate < notBeforeDate) {
    const weeksToSkip = Math.ceil(daysBetween(nextDate, notBeforeDate) / 7);
    nextDate = advanceDate(nextDate, weeksToSkip * 7);
    nextFollowingDate = advanceDate(nextDate, 7);
    if (weeksToSkip % 2 === 1) {
      nextType = collectionTypeAfter(nextType);
    }
  }
  const nextReminder = scheduleFor(
    nextDate,
    record.lead_days,
    record.local_time,
    record.time_zone
  );
  if (!nextReminder) {
    await removeSubscription(database, record.endpoint);
    return;
  }
  const nextNotificationId = `${nextDate}:${record.lead_days}:${record.local_time}:${record.time_zone}`;
  await database
    .prepare(
      `UPDATE reminder_subscriptions SET collection_date = ?, following_date = ?,
         collection_type = ?, scheduled_at = ?, notification_id = ?, claim_until = NULL,
         updated_at = ? WHERE endpoint = ? AND notification_id = ?`
    )
    .bind(
      nextDate,
      nextFollowingDate,
      nextType,
      nextReminder.scheduledAt.toISOString(),
      nextNotificationId,
      now.toISOString(),
      record.endpoint,
      record.notification_id
    )
    .run();
};

const sendDueRecord = async (
  database: ReminderDatabase,
  record: ReminderRecord,
  keys: VapidConfiguration,
  now: Date,
  claimedThrough: string,
  send: (
    subscription: WebPushSubscription,
    payload: string,
    keys: VapidConfiguration
  ) => Promise<Response>
): Promise<void> => {
  const nowIso = now.toISOString();
  const claim = await database
    .prepare(
      `UPDATE reminder_subscriptions SET claim_until = ?
       WHERE endpoint = ? AND notification_id = ? AND scheduled_at <= ?
         AND (claim_until IS NULL OR claim_until <= ?)`
    )
    .bind(
      claimedThrough,
      record.endpoint,
      record.notification_id,
      nowIso,
      nowIso
    )
    .run();
  if (claim.meta?.changes !== 1) {
    return;
  }

  const localToday = calendarDateInTimeZone(now, record.time_zone);
  if (record.collection_date < localToday) {
    await advanceSubscription(database, record, now, localToday);
    return;
  }

  let storedSubscription: unknown;
  try {
    storedSubscription = JSON.parse(record.subscription_json);
  } catch {
    await removeSubscription(database, record.endpoint);
    return;
  }
  const subscription = parseWebPushSubscription(storedSubscription);
  if (!subscription) {
    await removeSubscription(database, record.endpoint);
    return;
  }

  const daysUntilCollection = Math.max(
    0,
    daysBetween(localToday, record.collection_date)
  );
  const daysText = daysUntilCollection === 1 ? "day" : "days";
  const reminderText =
    daysUntilCollection === 0
      ? "Bins are collected today."
      : `Bins are collected in ${daysUntilCollection} ${daysText}.`;
  const body = JSON.stringify({
    version: 1,
    notificationId: record.notification_id,
    collectionDate: record.collection_date,
    leadDays: record.lead_days,
    title: "Bin collection reminder",
    body: reminderText,
  });
  try {
    const response = await send(subscription, body, keys);
    if (response.status === 404 || response.status === 410) {
      await removeSubscription(database, record.endpoint, record.revision);
    } else if (response.ok) {
      await advanceSubscription(database, record, now);
    } else if (
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 408 &&
      response.status !== 429
    ) {
      await advanceSubscription(database, record, now);
    } else {
      await releaseClaim(database, record);
    }
  } catch {
    await releaseClaim(database, record);
  }
};

/** Send due notifications once, advance the two-week schedule snapshot, and remove expired subscriptions. */
export const sendDueReminders = async (
  environment: ReminderEnvironment,
  now = new Date(),
  send: (
    subscription: WebPushSubscription,
    payload: string,
    keys: VapidConfiguration
  ) => Promise<Response> = (subscription, payload, vapid) =>
    sendWebPush({ subscription, payload, vapid, ttl: 60 * 60 * 24 })
): Promise<void> => {
  const database = environment.REMINDERS;
  if (!database) {
    return;
  }
  const nowIso = now.toISOString();
  await database
    .prepare("DELETE FROM reminder_subscriptions WHERE updated_at < ?")
    .bind(new Date(now.getTime() - 90 * 24 * 60 * 60_000).toISOString())
    .run();
  const keys = await readVapidConfiguration(environment);
  if (!keys) {
    return;
  }
  const claimedThrough = new Date(now.getTime() + 30 * 60_000).toISOString();
  const { results } = await database
    .prepare(
      `SELECT endpoint, subscription_json, collection_date, following_date, collection_type,
              lead_days, local_time, time_zone, scheduled_at, notification_id, claim_until, revision
       FROM reminder_subscriptions
       WHERE scheduled_at <= ? AND (claim_until IS NULL OR claim_until <= ?)
       ORDER BY scheduled_at LIMIT 100`
    )
    .bind(nowIso, nowIso)
    .all<ReminderRecord>();

  await Promise.all(
    results.map((record) =>
      sendDueRecord(database, record, keys, now, claimedThrough, send)
    )
  );
};
