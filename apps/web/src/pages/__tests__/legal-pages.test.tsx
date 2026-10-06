// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PrivacyPage } from "@/pages/privacy";
import { TermsPage } from "@/pages/terms";

describe("legal pages", () => {
  afterEach(cleanup);

  it("renders the privacy policy on the main app", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { name: "Privacy policy" })
    ).toBeTruthy();
    expect(
      screen.getByText(/does not receive or retain your street address/u)
    ).toBeTruthy();
  });

  it("renders the terms and links to the app's privacy page", () => {
    render(<TermsPage />);

    expect(
      screen.getByRole("heading", { name: "Terms of service" })
    ).toBeTruthy();
    expect(
      screen
        .getAllByRole("link", { name: "Privacy Policy" })
        .every((link) => link.getAttribute("href") === "/privacy")
    ).toBeTruthy();
  });
});
