import { useEffect, useRef, useState } from "react";

import { BinHelpControl } from "@/components/bin-help";
import { NotificationSettings } from "@/components/notification-settings";
import { PwaInstallHelp, PwaStatus } from "@/components/pwa-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAddressLookup } from "@/hooks/use-address-lookup";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { isReminderBrowserSupported } from "@/hooks/use-reminder-delivery";
import { ADDRESS_LENGTH_LIMIT } from "@/lib/address";
import { binTypeFromName } from "@/lib/bin-items";
import { readNotificationPreferences } from "@/lib/notifications";
import {
  daysUntilCollection,
  formatCollectionDate,
  resolveNextCollection,
} from "@/lib/schedule";
import type { ScheduleResponse } from "@/lib/schedule";

const describeRelativeDate = (days: number): string => {
  if (days === 0) {
    return "Put these out today";
  }
  if (days === 1) {
    return "Put these out tomorrow";
  }
  return `In ${days} days`;
};

const collectionHighlightClass = (
  type: ScheduleResponse["nextCollection"]["type"] | undefined
): string => {
  switch (type) {
    case "yellow": {
      return "bg-yellow-bin";
    }
    case "red": {
      return "bg-red-bin";
    }
    default: {
      return "bg-highlight";
    }
  }
};

const collectionBadgeClass = (
  type: ScheduleResponse["nextCollection"]["type"] | undefined
): string => {
  switch (type) {
    case "yellow": {
      return "bg-yellow-bin text-yellow-copy";
    }
    case "red": {
      return "bg-red-bin text-red-copy";
    }
    default: {
      return "bg-panel text-copy-muted";
    }
  }
};

const selectVisibleSchedule = (
  canShowSchedule: boolean,
  state: ReturnType<typeof useAddressLookup>["state"],
  now: Date
): ScheduleResponse | null => {
  if (!canShowSchedule || state.kind !== "success") {
    return null;
  }
  return resolveNextCollection(state.schedule, now);
};

type Theme = "dark" | "light";

interface HomeHeaderProps {
  readonly onOpenReminders: () => void;
  readonly showReminderSettings: boolean;
  readonly onToggleTheme: () => void;
  readonly theme: Theme;
}

const HomeHeader = ({
  onOpenReminders,
  showReminderSettings,
  onToggleTheme,
  theme,
}: HomeHeaderProps) => (
  <header className="home-header mx-auto flex w-full max-w-6xl items-center justify-between gap-1 py-4 sm:gap-3 sm:py-5">
    <a
      aria-label="Hamilton Bin Day home"
      className="flex min-w-0 shrink items-center gap-2.5 leading-tight font-bold tracking-tight sm:gap-3"
      href="/"
    >
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-xl bg-forest text-lg text-white sm:size-10"
      >
        ♻
      </span>
      <span className="min-w-0">
        <span className="hidden min-[360px]:block sm:inline">Hamilton</span>
        <span className="block font-normal text-copy-muted sm:ml-1 sm:inline">
          Bin Day
        </span>
      </span>
    </a>
    <nav
      aria-label="Main navigation"
      className="flex shrink-0 items-center gap-0.5 sm:gap-3"
    >
      {showReminderSettings && (
        <button
          aria-controls="notification-settings-dialog"
          aria-haspopup="dialog"
          className="inline-flex min-h-11 items-center rounded-lg px-2 py-2 text-sm font-semibold text-sage-dark underline-offset-4 hover:underline sm:px-0"
          onClick={onOpenReminders}
          type="button"
        >
          <span className="sm:hidden">Remind</span>
          <span className="hidden sm:inline">Reminders</span>
        </button>
      )}
      <PwaInstallHelp />
      <a
        className="inline-flex min-h-11 items-center rounded-lg px-1 py-2 text-sm font-semibold text-sage-dark underline-offset-4 hover:underline sm:px-0"
        href="/what-goes-where"
      >
        <span className="sm:hidden">Items</span>
        <span className="hidden sm:inline">What goes where?</span>
      </a>
      <a
        className="inline-flex min-h-11 items-center rounded-lg px-1 py-2 text-sm font-semibold text-sage-dark underline-offset-4 hover:underline sm:px-0"
        href="/docs/"
      >
        Docs
      </a>
      <button
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        aria-pressed={theme === "light"}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-sage-border bg-panel px-1.5 py-2 text-sm font-semibold text-ink transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-leaf sm:px-3"
        onClick={onToggleTheme}
        type="button"
      >
        <span aria-hidden="true">{theme === "dark" ? "☼" : "☾"}</span>
        <span className="hidden sm:inline">
          {theme === "dark" ? "Light" : "Dark"}
        </span>
      </button>
    </nav>
  </header>
);

interface CollectionCardProps {
  readonly className?: string;
  readonly relativeCollectionDate: string;
  readonly schedule: ScheduleResponse | null;
}

const CollectionCard = ({
  className = "",
  relativeCollectionDate,
  schedule,
}: CollectionCardProps) => (
  <div
    aria-live="polite"
    className={`home-schedule relative mx-auto w-full max-w-md ${className}`}
  >
    <div
      className={`${collectionHighlightClass(schedule?.nextCollection.type)} absolute -inset-2 rounded-4xl sm:-inset-5`}
    />
    <Card
      className={`relative flex flex-col ${schedule ? "min-h-0 md:min-h-[30rem]" : "min-h-[30rem]"}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-card-border p-5 sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-caption text-caption uppercase">
            Next collection
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
            {schedule
              ? formatCollectionDate(schedule.nextCollection.date)
              : "Your collection day"}
          </h2>
          <p className="mt-1 text-sm text-address-muted">
            {schedule?.address ?? "Your address, at a glance"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1.5 text-xs font-bold tracking-wide whitespace-nowrap uppercase sm:px-3 ${collectionBadgeClass(schedule?.nextCollection.type)}`}
        >
          {schedule ? `${schedule.nextCollection.type} week` : "Hamilton"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {schedule ? (
          <>
            <p className="text-sm text-detail-muted">
              {relativeCollectionDate}
            </p>
            <ul className="mt-4 space-y-3">
              {schedule.nextCollection.bins.map((bin) => (
                <li
                  className="flex items-center justify-between gap-3 rounded-xl bg-panel px-4 py-3"
                  key={bin}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-check"
                    >
                      ✓
                    </span>
                    <span className="font-medium">{bin}</span>
                  </span>
                  <BinHelpControl bin={binTypeFromName(bin)} binName={bin} />
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-detail-muted">
              Regular collection: {schedule.collectionDayName}
            </p>
          </>
        ) : (
          <div className="my-auto rounded-2xl bg-panel p-5 text-center sm:p-6">
            <span
              aria-hidden="true"
              className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface text-2xl text-moss-dark"
            >
              ⌂
            </span>
            <p className="mt-4 font-semibold">Your schedule, made simple</p>
            <p className="mt-2 text-sm leading-6 text-detail-muted">
              Enter a Hamilton address to see your next bin collection and which
              bins to put out.
            </p>
          </div>
        )}
      </div>
      {schedule && (
        <div className="grid grid-cols-2 border-t border-card-border text-center text-sm">
          <div className="p-4">
            <span className="block text-xs text-caption">Next red week</span>
            <span className="mt-1 block font-semibold">
              {formatCollectionDate(schedule.redBin)}
            </span>
          </div>
          <div className="border-l border-card-border p-4">
            <span className="block text-xs text-caption">Next yellow week</span>
            <span className="mt-1 block font-semibold">
              {formatCollectionDate(schedule.yellowBin)}
            </span>
          </div>
        </div>
      )}
    </Card>
  </div>
);

/** Render the address lookup and collection schedule home page.
 * @returns The home page element.
 */
export const HomePage = () => {
  const { address, lookupRevision, setAddress, state, submitLookup } =
    useAddressLookup();
  const reminderDialogRef = useRef<HTMLDialogElement>(null);
  const isOnline = useNetworkStatus();
  const previousOnline = useRef(isOnline);
  const [minimumVisibleLookupRevision, setMinimumVisibleLookupRevision] =
    useState(0);
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark"
  );
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!isOnline || !previousOnline.current) {
      setMinimumVisibleLookupRevision(lookupRevision + 1);
    }
    previousOnline.current = isOnline;
  }, [isOnline, lookupRevision]);

  useEffect(() => {
    const refreshNow = () => setNow(new Date());
    const interval = window.setInterval(refreshNow, 60_000);

    document.addEventListener("visibilitychange", refreshNow);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshNow);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", nextTheme === "light" ? "#f7f6f2" : "#171d19");
    setTheme(nextTheme);
    try {
      window.localStorage.setItem("hamilton-bin-day-theme", nextTheme);
      window.localStorage.removeItem("hcc-bin-day-theme");
    } catch {
      // Keep the toggle usable when browser storage is unavailable.
    }
  };

  const schedule = selectVisibleSchedule(
    isOnline && lookupRevision >= minimumVisibleLookupRevision,
    state,
    now
  );
  const until = schedule
    ? daysUntilCollection(schedule.nextCollection.date, now)
    : null;
  const relativeCollectionDate =
    until === null ? "" : describeRelativeDate(until);
  const showReminderSettings =
    isReminderBrowserSupported() || readNotificationPreferences().enabled;
  const openReminderSettings = () => {
    const dialog = reminderDialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  };

  return (
    <main className="home-page flex min-h-dvh flex-col bg-canvas px-4 pb-6 text-ink sm:px-5">
      <HomeHeader
        onOpenReminders={openReminderSettings}
        onToggleTheme={toggleTheme}
        showReminderSettings={showReminderSettings}
        theme={theme}
      />

      <PwaStatus isOnline={isOnline} />
      <NotificationSettings
        cancelMissingSchedule={state.kind === "not-found"}
        dialogRef={reminderDialogRef}
        schedule={schedule}
      />

      <section className="home-lookup mx-auto grid w-full max-w-6xl gap-9 pt-8 pb-10 sm:gap-12 sm:pt-12 sm:pb-12 md:grid-cols-[1fr_0.85fr] md:items-center md:py-12">
        {schedule && (
          <CollectionCard
            className="order-1 md:order-2"
            relativeCollectionDate={relativeCollectionDate}
            schedule={schedule}
          />
        )}
        <div
          className={`home-lookup-copy ${schedule ? "order-2 md:order-1" : ""}`}
        >
          <p className="mb-4 hidden items-center gap-2 rounded-full border border-sage-border bg-surface px-3 py-1.5 text-xs font-bold tracking-eyebrow text-sage-copy uppercase sm:mb-5 md:inline-flex">
            <span className="size-2 rounded-full bg-leaf" /> Hamilton, New
            Zealand
          </p>
          <h1
            className={`max-w-xl text-4xl leading-heading font-semibold tracking-heading sm:text-6xl ${schedule ? "sr-only md:not-sr-only md:block" : ""}`}
          >
            Never miss your <span className="text-moss">bin day</span> again.
          </h1>
          <p
            className={`mt-4 max-w-lg text-base leading-7 text-body-muted sm:mt-6 sm:text-lg sm:leading-8 ${schedule ? "hidden md:block" : ""}`}
          >
            Look up your address to see exactly what to put out and when your
            next collection is.
          </p>
          {schedule && (
            <p className="mb-2 text-sm font-semibold text-copy-muted md:hidden">
              Change address
            </p>
          )}
          <form
            className={`flex max-w-xl flex-col gap-2 rounded-2xl border border-paper-border bg-surface p-2 shadow-lookup sm:flex-row sm:gap-3 ${schedule ? "mt-0 md:mt-9" : "mt-6 sm:mt-9"}`}
            onSubmit={submitLookup}
          >
            <label className="sr-only" htmlFor="address">
              Hamilton street address
            </label>
            <Input
              autoComplete="street-address"
              className="min-w-0 flex-1"
              id="address"
              maxLength={ADDRESS_LENGTH_LIMIT}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Try 12 Grey Street"
              value={address}
            />
            <Button
              className="min-h-12 w-full whitespace-nowrap sm:w-auto"
              disabled={state.kind === "loading"}
              type="submit"
            >
              {state.kind === "loading" ? "Checking…" : "Find my bin day"}
            </Button>
          </form>
          <p aria-live="polite" className="mt-4 text-sm text-copy-muted">
            {state.kind === "error" && state.message}
            {state.kind === "not-found" &&
              (state.matches.length
                ? `No exact match. Try: ${state.matches.slice(0, 4).join(", ")}`
                : "No matching address found. Check the street number and try again.")}
          </p>
        </div>

        {!schedule && (
          <CollectionCard
            relativeCollectionDate={relativeCollectionDate}
            schedule={schedule}
          />
        )}
      </section>
      <section className="home-steps mx-auto grid w-full max-w-6xl gap-5 border-t border-footer-border py-6 text-sm text-footer-copy md:grid-cols-3 md:gap-4 md:pt-6">
        <div>
          <span className="font-semibold text-step-copy">
            01 / Find your address
          </span>
          <p className="mt-1">Search an address in Hamilton.</p>
        </div>
        <div>
          <span className="font-semibold text-step-copy">
            02 / Check the next date
          </span>
          <p className="mt-1">See your next red or yellow week.</p>
        </div>
        <div>
          <span className="font-semibold text-step-copy">
            03 / Put the right bins out
          </span>
          <p className="mt-1">Get the collection details at a glance.</p>
        </div>
      </section>
      <footer className="home-footer mx-auto mt-auto flex w-full max-w-6xl flex-col gap-3 border-t border-footer-border pt-5 text-xs leading-5 text-footer-muted sm:flex-row sm:justify-between sm:gap-2 sm:pt-4">
        <span>
          Independent community tool · Data from{" "}
          <a
            className="underline underline-offset-2 hover:text-ink"
            href="https://hamilton.govt.nz/"
          >
            Hamilton City Council
          </a>
        </span>
        <nav
          aria-label="Site information"
          className="flex flex-wrap gap-x-4 gap-y-1"
        >
          {showReminderSettings && (
            <button
              aria-controls="notification-settings-dialog"
              aria-haspopup="dialog"
              className="underline underline-offset-2"
              onClick={openReminderSettings}
              type="button"
            >
              Reminders
            </button>
          )}
          <a className="underline underline-offset-2" href="/docs/">
            Docs
          </a>
          <a className="underline underline-offset-2" href="/privacy">
            Privacy
          </a>
          <a className="underline underline-offset-2" href="/what-goes-where">
            What goes where?
          </a>
          <a className="underline underline-offset-2" href="/terms">
            Terms
          </a>
        </nav>
      </footer>
    </main>
  );
};
