import { useEffect, useState } from "react";

import {
  calculateReminderSchedule,
  readNotificationPreferences,
  resolveNotificationPermissionState,
  saveNotificationPreferences,
} from "@/lib/notifications";
import type {
  NotificationPreferences,
  NotificationPermissionState,
  ReminderLeadDays,
} from "@/lib/notifications";
import { formatCollectionDate } from "@/lib/schedule";
import type { ScheduleResponse } from "@/lib/schedule";

const readDeviceTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

const describeDefaultPermission = (
  enabled: boolean,
  storageAvailable: boolean
): string => {
  if (!enabled) {
    return "Turn reminders on to save your preference on this device.";
  }
  if (!storageAvailable) {
    return "Your reminder preference could not be saved on this device.";
  }
  return "Your reminder preference is saved on this device.";
};

const readPermissionState = (): NotificationPermissionState => {
  const hasNotification = "Notification" in window;
  return resolveNotificationPermissionState({
    hasNotification,
    hasPushManager: "PushManager" in window,
    hasServiceWorker: "serviceWorker" in navigator,
    permission: hasNotification ? Notification.permission : "default",
    secureContext: window.isSecureContext,
  });
};

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

/** Let the user save local reminder intent while clearly reporting delivery availability. */
export const NotificationSettings = ({
  schedule,
}: {
  readonly schedule: ScheduleResponse | null;
}) => {
  const [preferences, setPreferences] = useState(readNotificationPreferences);
  const [permission, setPermission] =
    useState<NotificationPermissionState>(readPermissionState);
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    const refreshPermission = () => setPermission(readPermissionState());
    window.addEventListener("focus", refreshPermission);
    return () => window.removeEventListener("focus", refreshPermission);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    const updateConsent = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({
          enabled: preferences.enabled && storageAvailable,
          type: "NOTIFICATION_CONSENT",
        });
      } catch {
        // Preference storage remains usable when service workers are unavailable.
      }
    };
    void updateConsent();
  }, [preferences.enabled, storageAvailable]);

  const save = (next: NotificationPreferences) => {
    setPreferences(next);
    setStorageAvailable(saveNotificationPreferences(next));
  };
  const timeZone = readDeviceTimeZone();
  const reminder = schedule
    ? calculateReminderSchedule(
        schedule.nextCollection.date,
        preferences,
        timeZone
      )
    : null;

  return (
    <section
      aria-labelledby="notification-settings-title"
      className="border-paper-border bg-surface mx-auto mb-8 w-full max-w-6xl rounded-2xl border p-5 sm:p-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h2
            className="text-lg font-semibold"
            id="notification-settings-title"
          >
            Bin-day reminders
          </h2>
          <p className="text-copy-muted mt-2 text-sm leading-6">
            Choose when you would like a reminder. Your preference is saved only
            in this browser on this device.
          </p>
        </div>
        <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-3 font-semibold">
          <input
            checked={preferences.enabled}
            className="accent-forest size-5"
            onChange={(event) =>
              save({ ...preferences, enabled: event.target.checked })
            }
            type="checkbox"
          />
          Reminders {preferences.enabled ? "on" : "off"}
        </label>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Remind me
          <select
            className="border-sage-border bg-panel text-ink mt-2 min-h-11 w-full rounded-xl border px-3"
            disabled={!preferences.enabled}
            onChange={(event) =>
              save({
                ...preferences,
                leadDays: leadDaysFromValue(event.target.value),
              })
            }
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
            className="border-sage-border bg-panel text-ink mt-2 min-h-11 w-full rounded-xl border px-3"
            disabled={!preferences.enabled}
            onChange={(event) => {
              if (event.target.value) {
                save({ ...preferences, localTime: event.target.value });
              } else {
                event.currentTarget.value = preferences.localTime;
              }
            }}
            required
            type="time"
            value={preferences.localTime}
          />
        </label>
      </div>

      {reminder && (
        <p className="bg-panel mt-4 rounded-xl p-4 text-sm">
          Planned reminder: {formatCollectionDate(reminder.scheduledLocalDate)}
          at {reminder.scheduledLocalTime} ({reminder.timeZone}). This is a
          preview only; background delivery is not configured.
        </p>
      )}

      <div aria-live="polite" className="bg-panel mt-5 rounded-xl p-4 text-sm">
        <output className="block">
          Background delivery is not configured. This version sends no reminders
          and does not prompt for notification permission.
        </output>
        {!storageAvailable && (
          <output className="block">
            This browser blocked local storage, so your reminder preference
            could not be saved.
          </output>
        )}
        {permission === "unsupported" && (
          <output className="block">
            This browser does not support web notifications. You can still edit
            your preference, but reminders are unavailable here.
          </output>
        )}
        {permission === "insecure" && (
          <output className="block">
            Notifications require a secure HTTPS connection. Reminder delivery
            is unavailable on this connection.
          </output>
        )}
        {permission === "denied" && (
          <output className="block">
            Notifications are blocked in browser settings. Change this site’s
            notification permission there before reminders can be delivered.
          </output>
        )}
        {permission === "granted" && (
          <output className="block">
            Browser notification permission is granted.
          </output>
        )}
        {permission === "default" && (
          <output className="block">
            {describeDefaultPermission(preferences.enabled, storageAvailable)}
          </output>
        )}
      </div>

      <p className="text-copy-muted mt-3 text-xs leading-5">
        iPhone and iPad web push requires adding this app to the Home Screen and
        using a supported iOS version. No notification permission is requested
        until background delivery is available.
      </p>
    </section>
  );
};
