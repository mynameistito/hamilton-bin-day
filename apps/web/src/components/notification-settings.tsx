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
import { formatCollectionDate } from "@/lib/schedule";
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

/** Render consent, schedule, and delivery status for bin-day reminders. */
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
  const timeZone = readDeviceTimeZone();
  const reminder = schedule
    ? calculateReminderSchedule(
        schedule.nextCollection.date,
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
      <section className="border-card-border bg-surface text-ink h-dvh max-h-none w-full overflow-y-auto rounded-none border p-5 shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              className="text-xl font-semibold"
              id="notification-settings-title"
            >
              Bin-day reminders
            </h2>
            <p className="text-copy-muted mt-2 text-sm leading-6">
              Choose when to get a notification before collection.
            </p>
          </div>
          <button
            aria-label="Close reminder settings"
            className="border-sage-border bg-surface text-step-copy focus-visible:outline-focus-leaf hover:bg-panel inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border text-xl transition focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <label className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
          <input
            checked={preferences.enabled}
            className="accent-forest size-5"
            onChange={(event) => {
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
              className="border-sage-border bg-panel text-ink mt-2 min-h-11 w-full rounded-xl border px-3 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!preferences.enabled}
              onChange={(event) => {
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
              className="border-sage-border bg-panel text-ink mt-2 min-h-11 w-full rounded-xl border px-3 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!preferences.enabled}
              onChange={(event) => {
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
              <output className="text-copy-muted mt-1 block text-xs">
                {timeInputMessage}
              </output>
            )}
          </label>
        </div>

        {reminder && (
          <p className="bg-panel mt-4 rounded-xl p-4 text-sm">
            Next reminder: {formatCollectionDate(reminder.scheduledLocalDate)}
            at {reminder.scheduledLocalTime}.
          </p>
        )}

        <div
          aria-live="polite"
          className="bg-panel mt-4 rounded-xl p-3 text-sm"
        >
          <output>{statusMessage}</output>
        </div>

        <p className="text-copy-muted mt-4 text-xs leading-5">
          Works on Android and desktop. On iPhone or iPad, add this app to your
          Home Screen. Your address is not saved for reminders.{" "}
          <a className="underline underline-offset-2" href="/docs/privacy/">
            Privacy details
          </a>
        </p>
      </section>
    </dialog>
  );
};
