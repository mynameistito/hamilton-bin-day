// oxlint-disable react/no-unescaped-entities -- Preserve the terms' published wording.
import { LegalPage } from "@/pages/legal-page";

/**
 * Render the site's terms of service on the main TanStack app.
 * @returns The terms page element.
 */
export const TermsPage = () => (
  <LegalPage title="Terms of service">
    <p>
      <strong>Last updated: 3 October 2026</strong>
    </p>
    <p>
      These terms apply when you access or use Hamilton Bin Day at{" "}
      <a className="underline" href="https://bin-day.mynameistito.com">
        bin-day.mynameistito.com
      </a>{" "}
      (the "site"). The site is published by <strong>mynameistito</strong> as an
      independent community project. By using it, you agree to these terms. If
      you do not agree, do not use the site.
    </p>
    <p>
      These terms are general information about using the site, not legal
      advice. Consider getting advice from a qualified professional if you need
      guidance about your legal obligations or rights.
    </p>
    <h2 className="text-xl font-semibold text-ink">What the site does</h2>
    <p>
      The site lets you search for a Hamilton, New Zealand address and view a
      bin collection schedule. It retrieves public information from Hamilton
      City Council's Fight the Landfill lookup service. The site is not
      operated, affiliated with, endorsed by, or supported by Hamilton City
      Council. The Council's information and services are authoritative.
    </p>
    <h2 className="text-xl font-semibold text-ink">Use of the service</h2>
    <p>You may use the site for personal, lawful purposes. You agree not to:</p>
    <ul className="list-disc space-y-2 pl-6">
      <li>
        use the site in a way that breaks the law or infringes another person's
        rights;
      </li>
      <li>
        interfere with, disrupt, probe, or attempt to gain unauthorised access
        to the site or its infrastructure;
      </li>
      <li>
        send excessive or automated requests that impair the service or the
        Council's lookup API; or
      </li>
      <li>
        misrepresent the site or its relationship with Hamilton City Council.
      </li>
    </ul>
    <p>
      We may limit or suspend access if needed to protect the site, its users,
      or third-party services, or to comply with law.
    </p>
    <h2 className="text-xl font-semibold text-ink">
      Information is provided as-is
    </h2>
    <p>
      Schedules are provided as a convenience and may be incomplete, delayed,
      inaccurate, or unavailable. Council data, collection arrangements,
      public-holiday schedules, and the lookup API can change without notice. We
      do not guarantee that a displayed date or container list is current or
      correct. Check Hamilton City Council's official waste and recycling
      information when accuracy matters, and follow Council instructions for
      collection.
    </p>
    <p>
      Do not rely on this site as the sole source for an important decision. We
      are not responsible for missed collections, incorrect results, service
      interruptions, or changes made by the Council or its service providers, to
      the extent the law allows.
    </p>
    <h2 className="text-xl font-semibold text-ink">
      Third-party services and links
    </h2>
    <p>
      The site depends on services operated by others, including Cloudflare and
      Hamilton City Council's public lookup API, and uses analytics providers as
      described in the{" "}
      <a className="underline" href="/privacy">
        Privacy Policy
      </a>
      . Those services have their own terms, availability, and privacy
      practices. We do not control or guarantee them, and links to third-party
      sites are provided for convenience rather than endorsement.
    </p>
    <h2 className="text-xl font-semibold text-ink">Intellectual property</h2>
    <p>
      The project software is made available under the{" "}
      <a
        className="underline"
        href="https://github.com/mynameistito/hcc-bin-day/blob/main/LICENSE"
      >
        MIT License
      </a>
      . That licence applies to the software and does not grant rights in
      Hamilton City Council data, third-party services, or marks. Council data
      is attributed to Hamilton City Council and remains subject to any terms
      that apply to that data. The name and branding of Hamilton City Council
      are not ours.
    </p>
    <h2 className="text-xl font-semibold text-ink">Availability and changes</h2>
    <p>
      The site is provided without a promise of continuous availability. We may
      change, suspend, or discontinue any part of it at any time. We may also
      update these terms; the current version and its last-updated date will be
      posted here. Continued use after an update means you accept the updated
      terms.
    </p>
    <h2 className="text-xl font-semibold text-ink">
      Disclaimers and liability
    </h2>
    <p>
      To the maximum extent permitted by New Zealand law, the site is provided
      "as is" and "as available", without warranties or guarantees that it will
      be accurate, reliable, secure, uninterrupted, or fit for a particular
      purpose. Nothing in these terms excludes or limits a right or remedy that
      cannot lawfully be excluded or limited, including any rights you may have
      under the Consumer Guarantees Act 1993 where that Act applies.
    </p>
    <p>
      To the maximum extent permitted by law, mynameistito is not liable for
      indirect or consequential loss, loss of data, or loss arising from your
      use of, or inability to use, the site or reliance on its results. These
      terms do not exclude liability where it would be unlawful to do so.
    </p>
    <h2 className="text-xl font-semibold text-ink">Privacy</h2>
    <p>
      Use of the site is also subject to the{" "}
      <a className="underline" href="/privacy">
        Privacy Policy
      </a>
      , which explains address searches, browser storage, analytics, and
      third-party processing.
    </p>
    <h2 className="text-xl font-semibold text-ink">
      Governing law and contact
    </h2>
    <p>
      These terms are governed by the laws of New Zealand. Any dispute is
      subject to the jurisdiction of New Zealand courts, except where applicable
      consumer law gives you a right to bring a claim elsewhere.
    </p>
    <p>
      Questions about these terms can be sent to <strong>mynameistito</strong>{" "}
      at{" "}
      <a
        className="underline"
        href="mailto:contact%2Bhcc-bin-day@mynameistito.com"
      >
        contact+hcc-bin-day@mynameistito.com
      </a>
      .
    </p>
  </LegalPage>
);
