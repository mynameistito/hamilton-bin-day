import {
  decodeUnknownSync,
  String as SchemaString,
  Struct,
} from "effect/Schema";
import { useEffect, useState } from "react";

import { resolveNotificationPermissionState } from "@/lib/notifications";
import type {
  NotificationPreferences,
  NotificationPermissionState,
} from "@/lib/notifications";
import {
  decodeApplicationServerKey,
  deletePushReminder,
  forgetPushEndpoint,
  readStoredPushEndpoint,
  rememberPushEndpoint,
  savePushReminder,
} from "@/lib/push-reminders";
import type { ScheduleResponse } from "@/lib/schedule";

const readDeviceTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;
const parsePublicKey = decodeUnknownSync(Struct({ publicKey: SchemaString }));

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

const isInstalledIosApp = (): boolean => {
  const isIos = /iPad|iPhone|iPod/u.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true);
  return !isIos || isStandalone;
};

const serializeSubscription = (subscription: PushSubscription) => {
  const json = subscription.toJSON();
  const auth = json.keys?.auth;
  const p256dh = json.keys?.p256dh;
  if (!(auth && p256dh)) {
    return null;
  }
  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: { auth, p256dh },
  };
};

const PUSH_CLEANUP = {
  missingEndpoint: "missing-endpoint",
  removed: "removed",
  serverFailed: "server-failed",
} as const;
type PushCleanupResult = (typeof PUSH_CLEANUP)[keyof typeof PUSH_CLEANUP];
const STORAGE_CLEANUP_FAILED =
  "Browser storage is unavailable and the server could not remove the subscription. It remains enabled; try again.";
const REMINDER_ENABLED_MESSAGE =
  "Reminders are enabled for the schedule shown. The server stores the push subscription and schedule preferences, not your address.";

/** Delete the server record and browser subscription using the active or cached endpoint. */
const cleanupPushSubscription = async (
  subscription: PushSubscription | null
): Promise<PushCleanupResult> => {
  const endpoint = subscription?.endpoint ?? readStoredPushEndpoint();
  if (!endpoint) {
    return PUSH_CLEANUP.missingEndpoint;
  }
  if (!(await deletePushReminder(endpoint))) {
    return PUSH_CLEANUP.serverFailed;
  }
  if (subscription) {
    try {
      await subscription.unsubscribe();
    } catch {
      // Server deletion is already confirmed, so a local browser error must not keep reminders enabled.
    }
  }
  forgetPushEndpoint();
  return PUSH_CLEANUP.removed;
};

const cleanupAndDisable = async (
  subscription: PushSubscription | null,
  preferences: NotificationPreferences,
  savePreferences: (next: NotificationPreferences) => boolean
): Promise<PushCleanupResult> => {
  const cleanup = await cleanupPushSubscription(subscription);
  if (cleanup === PUSH_CLEANUP.removed) {
    savePreferences({ ...preferences, enabled: false });
  }
  return cleanup;
};

const reportMissingSubscription = (
  cleanup: PushCleanupResult,
  active: boolean,
  setDeliveryActive: (active: boolean) => void,
  setDeliveryMessage: (message: string) => void
): void => {
  if (!active) {
    return;
  }
  if (cleanup === PUSH_CLEANUP.removed) {
    setDeliveryActive(false);
    setDeliveryMessage(
      "No browser push subscription exists, so its server-side reminder was removed and reminders are off."
    );
    return;
  }
  setDeliveryMessage(
    cleanup === PUSH_CLEANUP.missingEndpoint
      ? "No browser push subscription exists and server cleanup cannot be confirmed. Reminders remain on."
      : "No browser push subscription exists and the server could not remove its reminder. It remains enabled; try again."
  );
};

interface EnrollmentOutcome {
  readonly active: boolean;
  readonly message: string;
}

const enrollReminder = async (
  subscription: PushSubscription,
  schedule: ScheduleResponse,
  preferences: NotificationPreferences,
  savePreferences: (next: NotificationPreferences) => boolean
): Promise<EnrollmentOutcome> => {
  const nextPreferences = { ...preferences, enabled: true };
  try {
    const serialized = serializeSubscription(subscription);
    if (!serialized) {
      const cleanup = await cleanupPushSubscription(subscription);
      if (cleanup !== PUSH_CLEANUP.removed) {
        savePreferences(nextPreferences);
      }
      return {
        active: cleanup !== PUSH_CLEANUP.removed,
        message:
          cleanup === PUSH_CLEANUP.removed
            ? "This browser could not provide a complete push subscription. Any saved reminder was removed."
            : "This browser could not provide a complete push subscription, and server cleanup failed. Reminders remain on.",
      };
    }
    if (!rememberPushEndpoint(subscription.endpoint)) {
      const cleanup = await cleanupPushSubscription(subscription);
      if (cleanup !== PUSH_CLEANUP.removed) {
        savePreferences(nextPreferences);
        return {
          active: true,
          message:
            "Browser storage is unavailable and server cleanup failed. Reminders remain on until cleanup succeeds.",
        };
      }
      return {
        active: false,
        message:
          "Browser storage is unavailable, so the server subscription was removed and reminders remain off.",
      };
    }
    const saved = await savePushReminder(
      serialized,
      schedule,
      nextPreferences,
      readDeviceTimeZone()
    );
    if (!saved) {
      const cleanup = await cleanupPushSubscription(subscription);
      if (cleanup !== PUSH_CLEANUP.removed) {
        savePreferences(nextPreferences);
        return {
          active: true,
          message:
            "The server could not confirm or remove the subscription. Reminders remain on until cleanup succeeds.",
        };
      }
      return {
        active: false,
        message:
          "The subscription could not be saved on the server. Reminders remain off.",
      };
    }
    if (savePreferences(nextPreferences)) {
      return { active: true, message: REMINDER_ENABLED_MESSAGE };
    }
    const cleanup = await cleanupPushSubscription(subscription);
    if (cleanup === PUSH_CLEANUP.removed) {
      savePreferences({ ...nextPreferences, enabled: false });
      return {
        active: false,
        message:
          "Browser storage is unavailable, so the server subscription was removed and reminders remain off.",
      };
    }
    savePreferences(nextPreferences);
    return { active: true, message: STORAGE_CLEANUP_FAILED };
  } catch {
    const cleanup = await cleanupPushSubscription(subscription);
    if (cleanup === PUSH_CLEANUP.removed) {
      return {
        active: false,
        message:
          "Reminders could not be set up. Check your connection and try again.",
      };
    }
    rememberPushEndpoint(subscription.endpoint);
    savePreferences(nextPreferences);
    return {
      active: true,
      message:
        "Setup could not finish and server cleanup failed. Reminders remain enabled; try turning them off again.",
    };
  }
};

const readPublicKey = async (): Promise<string | null> => {
  const response = await fetch("/api/reminders/public-key");
  if (!response.ok) {
    return null;
  }
  try {
    const value: unknown = await response.json();
    return parsePublicKey(value).publicKey;
  } catch {
    return null;
  }
};

/** Manage explicit browser push consent and synchronize the address-free delivery snapshot. */
export const useReminderDelivery = (
  schedule: ScheduleResponse | null,
  cancelMissingSchedule: boolean,
  preferences: NotificationPreferences,
  savePreferences: (next: NotificationPreferences) => boolean
) => {
  const [permission, setPermission] =
    useState<NotificationPermissionState>(readPermissionState);
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [deliveryActive, setDeliveryActive] = useState(false);

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
          enabled: preferences.enabled,
          type: "NOTIFICATION_CONSENT",
        });
      } catch {
        // Server registration remains manageable if local Cache Storage is unavailable.
      }
    };
    void updateConsent();
  }, [preferences.enabled]);

  const enableReminders = async () => {
    if (!schedule) {
      setDeliveryMessage("Look up your address before enabling reminders.");
      return;
    }
    if (!isInstalledIosApp()) {
      setDeliveryMessage(
        "On iPhone or iPad, add this app to your Home Screen and open it there before enabling web push."
      );
      return;
    }
    const support = readPermissionState();
    setPermission(support);
    if (
      support === "unsupported" ||
      support === "insecure" ||
      support === "denied"
    ) {
      setDeliveryMessage(
        "Reminders cannot be enabled with this browser's current notification settings."
      );
      return;
    }

    let subscription: PushSubscription | null = null;
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        setDeliveryMessage(
          permissionResult === "denied"
            ? "Notifications are blocked. Change this site's permission in browser settings to enable reminders."
            : "Notification permission was not granted, so reminders remain off."
        );
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const publicKey = await readPublicKey();
        if (!publicKey) {
          setDeliveryMessage(
            "Background delivery is not configured on the server yet. No reminder was saved."
          );
          return;
        }
        // oxlint-disable-next-line react-doctor/effect-needs-cleanup -- SAFETY: Successfully enrolled subscriptions intentionally survive component unmounts; failed enrollment is removed before returning.
        subscription = await registration.pushManager.subscribe({
          applicationServerKey: decodeApplicationServerKey(publicKey),
          userVisibleOnly: true,
        });
      }
      const outcome = await enrollReminder(
        subscription,
        schedule,
        preferences,
        savePreferences
      );
      setDeliveryActive(outcome.active);
      setDeliveryMessage(outcome.message);
    } catch {
      if (subscription) {
        const cleanup = await cleanupPushSubscription(subscription);
        if (cleanup !== PUSH_CLEANUP.removed) {
          rememberPushEndpoint(subscription.endpoint);
          savePreferences({ ...preferences, enabled: true });
          setDeliveryActive(true);
          setDeliveryMessage(
            "Setup could not finish and server cleanup failed. Reminders remain enabled; try turning them off again."
          );
          return;
        }
      }
      setDeliveryMessage(
        "Reminders could not be set up. Check your connection and try again."
      );
    }
  };

  const disableReminders = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const cleanup = await cleanupPushSubscription(subscription);
      if (cleanup === PUSH_CLEANUP.missingEndpoint) {
        setDeliveryMessage(
          "No browser subscription or saved endpoint is available to confirm server cleanup. Reminders remain on."
        );
        return;
      }
      if (cleanup === PUSH_CLEANUP.serverFailed) {
        setDeliveryMessage(
          "The server could not remove this reminder. It remains enabled; try again."
        );
        return;
      }
      savePreferences({ ...preferences, enabled: false });
      setDeliveryActive(false);
      setDeliveryMessage(
        "Reminders are off and the server-side subscription was removed."
      );
    } catch {
      setDeliveryMessage(
        "Reminders could not be disabled. Check your connection and try again."
      );
    }
  };

  useEffect(() => {
    if (!preferences.enabled) {
      return;
    }
    let active = true;
    if (!schedule) {
      if (!cancelMissingSchedule) {
        return;
      }
      const removeMissingSchedule = async () => {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          const cleanup = await cleanupPushSubscription(subscription);
          if (cleanup === PUSH_CLEANUP.missingEndpoint) {
            if (active) {
              setDeliveryMessage(
                "The reminder could not be cancelled because no browser subscription or saved endpoint is available for server cleanup."
              );
            }
            return;
          }
          if (cleanup === PUSH_CLEANUP.serverFailed) {
            if (active) {
              setDeliveryMessage(
                "The server could not cancel the reminder because the new address has no matching schedule."
              );
            }
            return;
          }
          if (active) {
            savePreferences({ ...preferences, enabled: false });
            setDeliveryActive(false);
            setDeliveryMessage(
              "The reminder was cancelled because the new lookup has no collection schedule."
            );
          }
        } catch {
          if (active) {
            setDeliveryMessage(
              "The old reminder could not be cancelled. Turn reminders off and try again."
            );
          }
        }
      };
      void removeMissingSchedule();
      return () => {
        active = false;
      };
    }
    const syncSchedule = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        const serialized = subscription && serializeSubscription(subscription);
        if (!serialized || !subscription) {
          const cleanup = await cleanupAndDisable(
            null,
            preferences,
            savePreferences
          );
          reportMissingSubscription(
            cleanup,
            active,
            setDeliveryActive,
            setDeliveryMessage
          );
          return;
        }
        if (
          !savePreferences(preferences) ||
          !rememberPushEndpoint(subscription.endpoint)
        ) {
          const cleanup = await cleanupAndDisable(
            subscription,
            preferences,
            savePreferences
          );
          if (cleanup === PUSH_CLEANUP.removed) {
            setDeliveryActive(false);
            setDeliveryMessage(
              "Browser storage is unavailable, so the server subscription was removed and reminders were turned off."
            );
          } else if (active) {
            setDeliveryActive(true);
            setDeliveryMessage(STORAGE_CLEANUP_FAILED);
          }
          return;
        }
        const saved = await savePushReminder(
          serialized,
          schedule,
          preferences,
          readDeviceTimeZone()
        );
        if (active && !saved) {
          setDeliveryActive(false);
          setDeliveryMessage(
            "Your reminder update could not be saved. Any previous server subscription remains unchanged; reminders stay on in this browser. Try changing the setting again."
          );
        } else if (active) {
          setDeliveryActive(true);
        }
      } catch {
        if (active) {
          setDeliveryActive(false);
          setDeliveryMessage(
            "The server could not confirm your reminder status. Reminders stay on in this browser; any existing server subscription was not intentionally removed."
          );
        }
      }
    };
    void syncSchedule();
    return () => {
      active = false;
    };
  }, [cancelMissingSchedule, preferences, savePreferences, schedule]);

  return {
    deliveryActive,
    deliveryMessage,
    disableReminders,
    enableReminders,
    permission,
  };
};
