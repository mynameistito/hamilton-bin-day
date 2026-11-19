import { BinCataloguePage } from "./bin-catalogue";
import { HomePage } from "./home";
import { PrivacyPage } from "./privacy";
import { TermsPage } from "./terms";

/** Public app routes and the metadata for their initial HTML responses. */
export const sitePages = [
  {
    component: HomePage,
    description:
      "Find your next rubbish and recycling collection in Hamilton, New Zealand. Enter your street address to check your bin day and which bins to put out.",
    path: "/",
    title: "Hamilton Bin Day | Rubbish & Recycling Collection Days",
  },
  {
    component: BinCataloguePage,
    description:
      "Find what goes in each Hamilton bin. Search the Council sorter for recycling, rubbish, food scraps, glass and items that need special disposal.",
    path: "/what-goes-where/",
    title: "What Goes Where? Hamilton Recycling & Rubbish Bin Guide",
  },
  {
    component: PrivacyPage,
    description:
      "See how Hamilton Bin Day handles street addresses, reminder subscriptions and browser storage.",
    path: "/privacy/",
    title: "Privacy Policy | Hamilton Bin Day",
  },
  {
    component: TermsPage,
    description:
      "Read the terms for using the Hamilton Bin Day collection lookup, bin sorter and reminders.",
    path: "/terms/",
    title: "Terms of Service | Hamilton Bin Day",
  },
] as const;
