import type { ServiceWorkerScope } from "./service-worker-types";

export type { ServiceWorkerEvents } from "./service-worker-types";

/** Registers the service worker's lifecycle, notification, and fetch handlers. */
export function registerServiceWorker(scope?: ServiceWorkerScope): void;
