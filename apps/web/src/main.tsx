import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { BinCataloguePage } from "./pages/bin-catalogue";
import { HomePage } from "./pages/home";

import "./styles.css";

const loadReactGrab = async () => {
  try {
    await import("react-grab");
  } catch (error) {
    console.error("Failed to load react-grab in development.", error);
  }
};

if (import.meta.env.DEV) {
  void loadReactGrab();
}

const rootRoute = createRootRoute();
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});
const binCatalogueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/what-goes-where",
  component: BinCataloguePage,
});
const routeTree = rootRoute.addChildren([indexRoute, binCatalogueRoute]);
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.querySelector<HTMLDivElement>("#root");

if (!rootElement) {
  throw new Error("Missing application root element");
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

const registerServiceWorker = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  let updatePending = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updatePending) {
      window.location.reload();
    }
  });

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      type: "module",
    });
    const notifyUpdateAvailable = () => {
      if (navigator.serviceWorker.controller) {
        updatePending = true;
        window.dispatchEvent(new Event("app-update-available"));
      }
    };
    const observedInstalling = new WeakSet<ServiceWorker>();
    const observeInstalling = (installing: ServiceWorker | null) => {
      if (!installing || observedInstalling.has(installing)) {
        return;
      }
      observedInstalling.add(installing);
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed") {
          notifyUpdateAvailable();
        }
      });
    };
    registration.addEventListener("updatefound", () => {
      observeInstalling(registration.installing);
    });
    observeInstalling(registration.installing);
    if (registration.waiting) {
      notifyUpdateAvailable();
    }
  } catch {
    console.error("Failed to register the offline app shell.");
  }
};

window.addEventListener("load", registerServiceWorker);
