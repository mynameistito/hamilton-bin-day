import { Buffer } from "node:buffer";

import { describe, expect, vi, it } from "vitest";

import { readVapidConfiguration, sendWebPush } from "@/lib/web-push";
import type { WebPushSubscription } from "@/lib/web-push-subscription";

const encode = (value: ArrayBuffer): string =>
  Buffer.from(value).toString("base64url");

const makeVapidConfiguration = async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  if (!privateJwk.d) {
    throw new Error("The test VAPID keypair is incomplete");
  }
  return {
    VAPID_PRIVATE_KEY: privateJwk.d,
    VAPID_PUBLIC_KEY: encode(
      await crypto.subtle.exportKey("raw", pair.publicKey)
    ),
    VAPID_SUBJECT: "mailto:push-test@example.test",
  };
};

const makeSubscription = async (): Promise<WebPushSubscription> => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  return {
    endpoint: "https://fcm.googleapis.com/fcm/send/local-test-endpoint",
    expirationTime: null,
    keys: {
      auth: encode(crypto.getRandomValues(new Uint8Array(16)).buffer),
      p256dh: encode(await crypto.subtle.exportKey("raw", pair.publicKey)),
    },
  };
};

describe("server-only Web Push adapter", () => {
  it("constructs encrypted aes128gcm VAPID request without following redirects", async () => {
    const bindings = await makeVapidConfiguration();
    const vapid = await readVapidConfiguration(bindings);
    const subscription = await makeSubscription();
    const providerResponse = new Response(null, {
      status: 307,
      headers: { Location: "https://attacker.example/redirect" },
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(providerResponse);

    expect(vapid).not.toBeNull();
    if (!vapid) {
      throw new Error("Expected valid test VAPID keys");
    }
    const response = await sendWebPush(
      {
        subscription,
        payload: JSON.stringify({
          version: 1,
          notificationId: "2026-10-05:1:19:00:Pacific/Auckland",
          collectionDate: "2026-10-05",
          leadDays: 1,
          title: "Bin collection reminder",
          body: "Bins are collected in 1 day.",
        }),
        vapid,
        ttl: 86_400,
      },
      fetcher
    );

    const [call] = fetcher.mock.calls;
    if (!call) {
      throw new Error("Expected a push-service fetch call");
    }
    const [url, request] = call;
    if (!request) {
      throw new Error("Expected a Web Push RequestInit");
    }
    const headers = new Headers(request.headers);
    const { body } = request;
    if (!(body instanceof Uint8Array)) {
      throw new Error("Expected an encrypted binary push payload");
    }
    const authorization = headers.get("authorization") ?? "";

    expect({
      responseIsProviderResponse: response === providerResponse,
      callCount: fetcher.mock.calls.length,
      endpoint: url,
      method: request.method,
      redirect: request.redirect,
      contentEncoding: headers.get("content-encoding"),
      contentType: headers.get("content-type"),
      ttl: headers.get("ttl"),
      authorizationStartsWithVapid: authorization.startsWith("vapid t="),
      authorizationContainsPublicKey: authorization.includes(vapid.publicKey),
      bodyLength: body.byteLength,
      contentLength: headers.get("content-length"),
    }).toMatchObject({
      responseIsProviderResponse: true,
      callCount: 1,
      endpoint: subscription.endpoint,
      method: "post",
      redirect: "manual",
      contentEncoding: "aes128gcm",
      contentType: "application/octet-stream",
      ttl: "86400",
      authorizationStartsWithVapid: true,
      authorizationContainsPublicKey: true,
      bodyLength: expect.any(Number),
      contentLength: String(body.byteLength),
    });
    expect(body.byteLength).toBeGreaterThan(0);
  });

  it("rejects malformed, mismatched, and non-HTTPS VAPID configuration", async () => {
    const bindings = await makeVapidConfiguration();
    const other = await makeVapidConfiguration();

    await expect(
      readVapidConfiguration({ ...bindings, VAPID_PRIVATE_KEY: "invalid" })
    ).resolves.toBeNull();
    await expect(
      readVapidConfiguration({
        ...bindings,
        VAPID_PUBLIC_KEY: other.VAPID_PUBLIC_KEY,
      })
    ).resolves.toBeNull();
    await expect(
      readVapidConfiguration({
        ...bindings,
        VAPID_SUBJECT: "http://example.test",
      })
    ).resolves.toBeNull();
  });
});
