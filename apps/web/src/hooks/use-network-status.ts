import { useSyncExternalStore } from "react";

// oxlint-disable-next-line promise/prefer-await-to-callbacks -- useSyncExternalStore requires a synchronous subscription callback.
const subscribe = (callback: () => void): (() => void) => {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
};

const getSnapshot = (): boolean => navigator.onLine;

/** Subscribe to the browser's online state. */
export const useNetworkStatus = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, () => true);
