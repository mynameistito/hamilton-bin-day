import { useCallback, useState } from "react";
import type { RefObject } from "react";

import { useReminderDelivery } from "@/hooks/use-reminder-delivery";
import {
  calculateReminderSchedule,
  readNotificationPreferences,
  saveNotificationPreferences,
} from "@/lib/notifications";
import type {
  NotificationPreferences,
  ReminderLeadDays,
} from "@/lib/notifications";
import { daysUntilCollection, formatCollectionDate } from "@/lib/schedule";
import type { ScheduleResponse } from "@/lib/schedule";

const readDeviceTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

const leadDaysFromValue = (value: string): ReminderLeadDays => {
  switch (value) {
    case "0": {
      return 0;
    }
    case "2": {
      return 2;
    }
    case "7": {
      return 7;
    }
    default: {
      return 1;
    }
  }
};

const describePermission = (
  permission: string,
  storageAvailable: boolean
): string | null => {
  if (permission === "denied") {
    return "Notifications are blocked. Allow them in your browser settings.";
  }
  if (!storageAvailable) {
    return "Your settings could not be saved on this device.";
  }
  return null;
};

const describeReminderStatus = (
  deliveryMessage: string,
  permissionMessage: string | null,
  enabled: boolean,
  deliveryActive: boolean
): string => {
  if (deliveryMessage) {
    return deliveryMessage;
  }
  if (permissionMessage) {
    return permissionMessage;
  }
  if (!enabled) {
    return "Reminders are off.";
  }
  return deliveryActive ? "Reminders are on." : "Setting up your reminders…";
};

/** Render consent, schedule, and delivery status for bin-day reminders.
 * @returns The reminder settings dialog content, or `null` when unavailable.
 */
export const NotificationSettings = ({
  schedule,
  cancelMissingSchedule,
  dialogRef,
}: {
  readonly schedule: ScheduleResponse | null;
  readonly cancelMissingSchedule: boolean;
  readonly dialogRef: RefObject<HTMLDialogElement | null>;
}) => {
  const [preferences, setPreferences] = useState(readNotificationPreferences);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [timeInputMessage, setTimeInputMessage] = useState("");
  const save = useCallback((next: NotificationPreferences) => {
    setPreferences(next);
    const saved = saveNotificationPreferences(next);
    setStorageAvailable(saved);
    return saved;
  }, []);
  const {
    deliveryActive,
    deliveryMessage,
    disableReminders,
    enableReminders,
    permission,
  } = useReminderDelivery(
    schedule,
    cancelMissingSchedule,
    preferences,
    storageAvailable,
    save
  );
  const [timeZone, setTimeZone] = useState(readDeviceTimeZone);
  const [today, setToday] = useState(() => new Date());
  let collectionDate = schedule?.nextCollection.date;
  if (
    schedule &&
    preferences.leadDays === 7 &&
    daysUntilCollection(schedule.nextCollection.date, today) < 7
  ) {
    collectionDate =
      schedule.nextCollection.type === "red"
        ? schedule.yellowBin
        : schedule.redBin;
  }
  const reminder = schedule
    ? calculateReminderSchedule(
        collectionDate ?? schedule.nextCollection.date,
        preferences,
        timeZone
      )
    : null;
  const permissionMessage = describePermission(permission, storageAvailable);
  const statusMessage = describeReminderStatus(
    deliveryMessage,
    permissionMessage,
    preferences.enabled,
    deliveryActive
  );

  if (
    (permission === "unsupported" || permission === "insecure") &&
    !preferences.enabled
  ) {
    return null;
  }

  return (
    <dialog
      aria-labelledby="notification-settings-title"
      aria-modal="true"
      className="fixed inset-0 z-50 m-0 hidden h-dvh max-h-none w-full max-w-none items-end border-0 bg-black/55 p-0 open:grid sm:place-items-center sm:p-5"
      id="notification-settings-dialog"
      ref={dialogRef}
    >
      <section className="h-dvh max-h-none w-full overflow-y-auto rounded-none border border-card-border bg-surface p-5 text-ink shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              className="text-xl font-semibold"
              id="notification-settings-title"
            >
              Bin-day reminders
            </h2>
            <p className="mt-2 text-sm leading-6 text-copy-muted">
              Choose when to get a notification before collection.
            </p>
          </div>
          <button
            aria-label="Close reminder settings"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-sage-border bg-surface text-xl text-step-copy transition hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-leaf"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <label className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
          <input
            checked={preferences.enabled}
            className="size-5 accent-forest"
            onChange={(event) => {
              setToday(new Date());
              setTimeZone(readDeviceTimeZone());
              if (event.target.checked) {
                void enableReminders();
              } else {
                void disableReminders();
              }
            }}
            type="checkbox"
          />
          Get reminders
        </label>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Remind me
            <select
              className="mt-2 min-h-11 w-full rounded-xl border border-sage-border bg-panel px-3 text-ink disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!preferences.enabled}
              onChange={(event) => {
                setToday(new Date());
                setTimeZone(readDeviceTimeZone());
                const saved = save({
                  ...preferences,
                  leadDays: leadDaysFromValue(event.target.value),
                });
                if (!saved && preferences.enabled) {
                  void disableReminders();
                }
              }}
              value={String(preferences.leadDays)}
            >
              <option value="0">On collection day</option>
              <option value="1">The day before</option>
              <option value="2">2 days before</option>
              <option value="7">A week before</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            At my local time
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-sage-border bg-panel px-3 text-ink disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!preferences.enabled}
              onChange={(event) => {
                setToday(new Date());
                setTimeZone(readDeviceTimeZone());
                if (event.target.value) {
                  setTimeInputMessage("");
                  const saved = save({
                    ...preferences,
                    localTime: event.target.value,
                  });
                  if (!saved && preferences.enabled) {
                    void disableReminders();
                  }
                } else {
                  event.currentTarget.value = preferences.localTime;
                  setTimeInputMessage(
                    "Choose a reminder time. The previous time was kept."
                  );
                }
              }}
              required
              type="time"
              value={preferences.localTime}
            />
            {timeInputMessage && (
              <output className="mt-1 block text-xs text-copy-muted">
                {timeInputMessage}
              </output>
            )}
          </label>
        </div>

        {reminder && (
          <p className="mt-4 rounded-xl bg-panel p-4 text-sm">
            Next reminder: {formatCollectionDate(reminder.scheduledLocalDate)}{" "}
            at {reminder.scheduledLocalTime}.
          </p>
        )}

        <div
          aria-live="polite"
          className="mt-4 rounded-xl bg-panel p-3 text-sm"
        >
          <output>{statusMessage}</output>
        </div>

        <p className="mt-4 text-xs leading-5 text-copy-muted">
          Reminders continue each week until you turn them off. Dates are
          projected from your latest lookup, so exceptional Council changes
          require a fresh lookup. Works on Android and desktop. On iPhone or
          iPad, add this app to your Home Screen. Your address is not saved for
          reminders.{" "}
          <a className="underline underline-offset-2" href="/docs/privacy/">
            Privacy details
          </a>
        </p>
      </section>
    </dialog>
  );
};
