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
