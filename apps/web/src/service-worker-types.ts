/** Capabilities used by the service worker runtime. */
export interface ServiceWorkerScope {
  readonly Response: typeof Response;
  readonly URL: typeof URL;
  readonly location: { readonly origin: string };
  readonly console: { readonly warn: (message: string) => void };
  readonly caches: {
    readonly open: (name: string) => Promise<ServiceWorkerCache>;
    readonly match: (
      request: string | Request
    ) => Promise<Response | undefined>;
    readonly keys: () => Promise<string[]>;
    readonly delete: (name: string) => Promise<boolean>;
  };
  readonly fetch: (request: Request) => Promise<Response>;
  readonly skipWaiting: () => Promise<void> | void;
  readonly clients: {
    readonly claim: () => Promise<void>;
    readonly openWindow: (url: string) => Promise<object | null>;
  };
  readonly registration: {
    readonly showNotification: (
      title: string,
      options: NotificationOptions & { readonly renotify: boolean }
    ) => Promise<void>;
  };
  readonly addEventListener: <K extends keyof ServiceWorkerEvents>(
    type: K,
    listener: (event: ServiceWorkerEvents[K]) => void
  ) => void;
}

interface ServiceWorkerCache {
  readonly addAll: (requests: string[]) => Promise<void>;
  readonly put: (
    request: string | Request,
    response: Response
  ) => Promise<void>;
  readonly delete: (request: string | Request) => Promise<boolean>;
  readonly keys: () => Promise<readonly Request[]>;
  readonly match: (request: string | Request) => Promise<Response | undefined>;
}

interface ExtendableEvent {
  readonly waitUntil: (promise: Promise<unknown>) => void;
}

/** Events handled by the service worker. */
export interface ServiceWorkerEvents {
  install: ExtendableEvent;
  activate: ExtendableEvent;
  message: ExtendableEvent & {
    readonly data?: { readonly type?: string; readonly enabled?: boolean };
  };
  push: ExtendableEvent & {
    readonly data?: {
      // JSON is untrusted until the runtime validates the payload.
      // oxlint-disable-next-line anti-slop/no-unknown-returns
      readonly json: () => unknown;
    };
  };
  notificationclick: ExtendableEvent & {
    readonly notification: {
      readonly close: () => void;
      readonly data?: { readonly url?: string };
    };
  };
  fetch: {
    readonly request: Request;
    readonly respondWith: (response: Promise<Response>) => void;
  };
}
