import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const applyWaitingUpdate = async (): Promise<void> => {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
  } catch {
    console.error("Failed to apply the app update.");
  }
};

const isStandalonePwa = (): boolean =>
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  ("standalone" in navigator && navigator.standalone === true);

/** Show browser-specific instructions for adding the site to a home screen.
 * @returns The install instructions disclosure.
 */
export const PwaInstallHelp = () => {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (
        details?.open &&
        event.target instanceof Node &&
        !details.contains(event.target)
      ) {
        details.open = false;
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, []);

  return (
    <details
      className="group relative flex shrink-0 items-center"
      ref={detailsRef}
    >
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-lg px-1 py-2 text-sm font-semibold text-sage-dark underline-offset-4 hover:underline sm:px-0 [&::-webkit-details-marker]:hidden">
        <span className="sm:hidden">Install</span>
        <span className="hidden sm:inline">Install app</span>
        <span
          aria-hidden="true"
          className="text-xs transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="fixed inset-x-4 top-16 z-10 w-auto rounded-xl border border-paper-border bg-surface p-4 text-sm shadow-lg sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-72">
        <div className="flex items-start justify-between gap-3">
          <p className="pt-2 font-semibold">Add Hamilton Bin Day</p>
          <Button
            aria-label="Close install instructions"
            className="min-h-11 min-w-11 shrink-0"
            onClick={() => {
              const details = detailsRef.current;
              details?.removeAttribute("open");
              details?.querySelector<HTMLElement>("summary")?.focus();
            }}
            variant="outline"
          >
            <span aria-hidden="true">×</span>
          </Button>
        </div>
        <p className="mt-2 text-copy-muted">
          Android: use your browser menu and choose “Install app” or “Add to
          Home screen”.
        </p>
        <p className="mt-2 text-copy-muted">
          iPhone or iPad: in Safari, tap Share, then “Add to Home Screen”.
        </p>
      </div>
    </details>
  );
};

/** Explain offline data freshness and let installed PWAs apply ready updates.
 * @param props - Current online state.
 * @returns The PWA status and update controls.
 */
export const PwaStatus = ({ isOnline }: { readonly isOnline: boolean }) => {
  const isPwa = isStandalonePwa();
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!isPwa) {
      return;
    }
    const showUpdate = () => setUpdateAvailable(true);
    window.addEventListener("app-update-available", showUpdate);
    const checkForWaitingUpdate = async () => {
      try {
        const registration = await navigator.serviceWorker?.getRegistration();
        if (registration?.waiting) {
          showUpdate();
        }
      } catch {
        console.error("Failed to check for a pending app update.");
      }
    };
    void checkForWaitingUpdate();
    return () => {
      window.removeEventListener("app-update-available", showUpdate);
    };
  }, [isPwa]);

  if (isOnline && (!isPwa || !updateAvailable)) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="mx-auto mb-4 w-full max-w-6xl rounded-xl bg-panel px-4 py-3 text-sm"
    >
      {!isOnline && (
        <p>
          You’re offline. Live collection data can’t be refreshed, so schedules
          are hidden until you reconnect.
        </p>
      )}
      {updateAvailable && (
        <p className="flex flex-wrap items-center gap-3">
          A new version is ready.
          <button
            className="font-semibold underline underline-offset-2"
            onClick={applyWaitingUpdate}
            type="button"
          >
            Update app
          </button>
        </p>
      )}
    </div>
  );
};
