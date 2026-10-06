// oxlint-disable react/no-unescaped-entities -- Preserve the policy's published wording.
import { LegalPage } from "@/pages/legal-page";

/**
 * Render the site's privacy policy on the main TanStack app.
 * @returns The privacy policy page element.
 */
export const PrivacyPage = () => (
  <LegalPage title="Privacy policy">
    <p>
      <strong>Last updated: 3 October 2026</strong>
    </p>
    <p>
      Hamilton Bin Day ("the site", "we", or "us") is an independent community
      service published by <strong>mynameistito</strong>. This policy explains
      what information is handled when you visit{" "}
      <a className="underline" href="https://bin-day.mynameistito.com">
        bin-day.mynameistito.com
      </a>
      , why it is used, and the choices available to you. We do not require an
      account.
    </p>
    <p>
      This policy is general information about the site's practices, not legal
      advice. Consider getting advice from a qualified professional if you need
      guidance about your legal obligations or rights.
    </p>
    <h2 className="text-xl font-semibold text-ink">Information we handle</h2>
    <h3 className="text-lg font-semibold text-ink">Address searches</h3>
    <p>
      When you submit an address, the site puts it in the page URL as the{" "}
      <code>query</code> parameter and sends it to our Cloudflare-hosted
      service. The service forwards the search address to Hamilton City
      Council's public lookup API (<code>api2.hcc.govt.nz</code>) to find a
      matching address and collection schedule. The Council therefore receives
      the address you search for and may handle it under its own privacy policy
      and retention practices.
    </p>
    <p>
      The address in the <code>query</code> parameter remains in the current
      page URL until you remove it or navigate away. Browser history, bookmarks,
      screenshots, or a URL you share may expose it. After a successful lookup,
      the site also remembers the address in your browser using a first-party
      cookie for up to one year. If the browser's Cookie Store API is
      unavailable or the cookie cannot be written, the site falls back to local
      storage, which has no expiry set by this site. These copies stay on your
      device unless your browser syncs them or you clear them. To remove them,
      clear site data for this site in your browser; also remove the address
      from the URL and any saved or shared copies.
    </p>
    <p>
      We do not operate an application database of address searches or ask for
      your name, account credentials, or contact details to use the lookup.
      However, this does not mean that no one processes the search: it is sent
      to the Council API, and infrastructure providers may process request
      information as described below.
    </p>
    <h3 className="text-lg font-semibold text-ink">
      Analytics and infrastructure
    </h3>
    <p>
      The site is delivered through Cloudflare Workers and Cloudflare's network.
      Cloudflare processes technical information needed to deliver, secure, and
      operate the site. This may include IP address, device and browser
      information, request time, and requested URL. Cloudflare's handling of
      that information is also subject to{" "}
      <a className="underline" href="https://www.cloudflare.com/privacypolicy/">
        Cloudflare's privacy policy
      </a>
      .
    </p>
    <p>
      Cloudflare Web Analytics is enabled for the site. Its beacon provides
      site-usage measurements to Cloudflare. Cloudflare describes Web Analytics
      as cookie-free and does not use it to track individual visitors across
      sites; Cloudflare may process request and browser measurements to produce
      aggregate reports. See{" "}
      <a className="underline" href="https://www.cloudflare.com/web-analytics/">
        Cloudflare Web Analytics
      </a>
      .
    </p>
    <p>
      Cloudflare Zaraz is configured to send page-view measurements to{" "}
      <strong>Google Analytics 4</strong>. A page view can include the full page
      URL, including the <code>query</code> parameter, so Google Analytics may
      receive the address in a search URL. The configuration also includes a{" "}
      <strong>Twitter/X Pixel</strong> for tracked events. The site code
      currently does not call event-tracking functions, so the Pixel is not
      intentionally sent custom interaction events by this app. These services
      may receive information such as page or event details, referrer,
      browser/device information, and online identifiers; Google Analytics may
      use cookies or similar technologies. Zaraz's <code>hideOriginalIP</code>{" "}
      option is enabled for Google Analytics 4: Cloudflare removes the visitor's
      originating IP address before sending GA4 requests. This applies to GA4
      only; it does not remove the searched address from the page URL or change
      what Cloudflare or the Council API may process. Google and X handle
      information under their own terms and privacy policies:{" "}
      <a className="underline" href="https://policies.google.com/privacy">
        Google privacy
      </a>{" "}
      and{" "}
      <a className="underline" href="https://x.com/en/privacy">
        X privacy
      </a>
      .
    </p>
    <p>
      The current Cloudflare Zaraz configuration has its consent feature
      disabled, so the site does not show an analytics consent prompt. Analytics
      and other technologies can change if the Cloudflare configuration changes.
      This policy will be updated if the site's data practices materially
      change. You can limit cookies and browser storage in your browser, use
      tracking protection, or install an ad/tracker blocker. Blocking these
      technologies may affect analytics but should not prevent the address
      lookup from working.
    </p>
    <h3 className="text-lg font-semibold text-ink">Theme preference</h3>
    <p>
      If you change the site's light/dark theme, that preference is saved in
      your browser's local storage under <code>hcc-bin-day-theme</code>. It is
      not sent to us and remains until you clear the site's browser data.
    </p>
    <h3 className="text-lg font-semibold text-ink">Bin-day reminders</h3>
    <p>
      Reminder preferences (on/off, lead time, and local time) are saved in this
      browser's local storage under <code>hcc-bin-day-notifications-v1</code>.
      The opaque push endpoint is also kept locally under{" "}
      <code>hcc-bin-day-push-endpoint-v1</code> so the site can request
      server-side deletion even if the browser no longer reports its push
      subscription. If you explicitly turn reminders on, the browser then asks
      for notification permission. After permission is granted, the site sends
      the browser's push subscription, the next two collection dates and
      bin-week type, your selected lead time and local time, and your IANA
      timezone to its Cloudflare Worker and D1 database so it can schedule
      closed-app reminders.{" "}
      <strong>
        The reminder service does not receive or retain your street address or
        an address-derived lookup key.
      </strong>{" "}
      It cannot refresh the Council lookup while the app is closed; it uses the
      schedule snapshot from your latest successful lookup and projects the
      alternating weekly collection dates from that snapshot. Looking up an
      address again updates that snapshot.
    </p>
    <p>
      Reminders continue each week until you turn them off or the push provider
      reports the subscription as expired or gone. The service does not expire
      opted-in subscriptions based on age, including during delivery or
      configuration outages. Turning reminders off asks the service to delete
      the server-side subscription and then removes the browser push
      subscription. If server storage or VAPID configuration is unavailable,
      enabling reminders fails visibly rather than claiming a subscription was
      saved. Push services (including Apple, Google, Mozilla, or Microsoft,
      depending on the browser) receive delivery requests and may handle
      subscription endpoints and message metadata under their own privacy
      practices. Clear this site's browser data to remove the local preference;
      use the in-app off control to request deletion of the server-side
      subscription.
    </p>
    <h3 className="text-lg font-semibold text-ink">Messages you send us</h3>
    <p>
      If you email{" "}
      <a
        className="underline"
        href="mailto:contact%2Bhcc-bin-day@mynameistito.com"
      >
        contact+hcc-bin-day@mynameistito.com
      </a>
      , we receive the email address and any information you choose to include.
      We use it to respond and handle the matter raised. Email providers may
      process and retain the message as part of delivering email. Please do not
      include sensitive information unless it is necessary.
    </p>
    <h2 className="text-xl font-semibold text-ink">How we use information</h2>
    <p>
      We use address searches to return matching public collection data, browser
      storage to remember your address and theme preference, technical request
      information to serve and protect the site, and analytics measurements to
      understand site usage. We do not sell address searches or use them to
      create advertising profiles. Google Analytics and the configured X Pixel
      are third-party analytics/measurement tools, and their own processing is
      described above.
    </p>
    <h2 className="text-xl font-semibold text-ink">Sharing and retention</h2>
    <p>
      An address search is sent to Hamilton City Council's public API.
      Cloudflare processes site requests and analytics. Google Analytics
      receives page-view measurements through Zaraz; X may receive event data if
      event tracking is triggered. These providers process information under
      their own terms, and may handle it in countries outside New Zealand. We do
      not control their independent retention periods or processing practices;
      consult their privacy information for details.
    </p>
    <p>
      The site does not maintain an application database of address searches.
      Reminder records contain only the push subscription, schedule snapshot,
      timezone, and reminder preferences plus operational timestamps/claim
      state; they are removed on unsubscribe or when the push provider
      invalidates the endpoint. The sender cannot refresh the Council schedule
      without an address or equivalent lookup key, so it projects alternating
      weekly dates from the latest snapshot. Exceptional Council collection-date
      changes require a fresh lookup, which replaces that snapshot. Address and
      theme values remain in browser storage as described above. Technical,
      analytics, and push-delivery information may be retained by Cloudflare,
      Google, X, push providers, or the Council under their respective policies
      and settings.
    </p>
    <h2 className="text-xl font-semibold text-ink">
      Your choices and privacy requests
    </h2>
    <p>
      You can turn reminders off in the app to request deletion of their
      server-side subscription and clear local preferences through your browser
      settings. You can also clear the site cookie and local storage, remove the
      address from the page URL, use private browsing, or block analytics. To
      ask for access to, correction of, or deletion of other personal
      information we hold, email{" "}
      <a
        className="underline"
        href="mailto:contact%2Bhcc-bin-day@mynameistito.com"
      >
        contact+hcc-bin-day@mynameistito.com
      </a>
      . We may need enough information to locate the relevant message, but do
      not send extra sensitive details.
    </p>
    <p>
      New Zealand's Privacy Act 2020 may give you rights to access and correct
      personal information. If you are not satisfied with our response, you can
      contact the{" "}
      <a className="underline" href="https://www.privacy.org.nz/">
        Office of the Privacy Commissioner
      </a>
      .
    </p>
    <h2 className="text-xl font-semibold text-ink">Children's privacy</h2>
    <p>
      The site is a general-purpose collection lookup and is not directed at
      children. It does not knowingly ask children to provide personal
      information.
    </p>
    <h2 className="text-xl font-semibold text-ink">Changes and contact</h2>
    <p>
      We may update this policy when the site or its data practices change. The
      current version and its last-updated date will be published on this page.
      For privacy questions or requests, contact <strong>mynameistito</strong>{" "}
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
