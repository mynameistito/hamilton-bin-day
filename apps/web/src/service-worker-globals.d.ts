import type { ServiceWorkerEvents } from "./service-worker-types";

declare global {
  var clients: Clients;
  var registration: ServiceWorkerRegistration;
  function skipWaiting(): Promise<void>;
  function addEventListener<K extends keyof ServiceWorkerEvents>(
    type: K,
    listener: (event: ServiceWorkerEvents[K]) => void
  ): void;
}
