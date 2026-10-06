import { buildPushPayload } from "@block65/webcrypto-web-push";
import type {
  PushSubscription as Block65PushSubscription,
  VapidKeys,
} from "@block65/webcrypto-web-push";
import { z } from "zod";

import type { WebPushSubscription } from "@/lib/web-push-subscription";

/** VAPID material accepted by the server-side Web Push adapter. */
export type VapidConfiguration = VapidKeys;

/** Raw VAPID bindings provided by the deployment environment. */
export interface VapidEnvironment {
  readonly VAPID_PRIVATE_KEY?: string;
  readonly VAPID_PUBLIC_KEY?: string;
  readonly VAPID_SUBJECT?: string;
}

const Base64UrlPrivateKey = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
const Base64UrlPublicKey = z.string().regex(/^[A-Za-z0-9_-]{87}$/u);
const VapidSubject = z.string().refine((subject) => {
  if (/^mailto:[^\s@]+@[^\s@]+$/u.test(subject)) {
    return true;
  }
  try {
    const url = new URL(subject);
    return (
      url.protocol === "https:" &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
});

const VapidConfigurationSchema = z.strictObject({
  privateKey: Base64UrlPrivateKey,
  publicKey: Base64UrlPublicKey,
  subject: VapidSubject,
});

const decodeBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  );
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) ?? 0;
  }
  return bytes;
};

const encodeBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  const encoded = btoa(binary).replaceAll("+", "-").replaceAll("/", "_");
  return encoded.split("=")[0] ?? "";
};

const matchesVapidKeyPair = async (
  privateKeyValue: string,
  publicKeyValue: string
): Promise<boolean> => {
  try {
    const publicBytes = decodeBase64Url(publicKeyValue);
    if (publicBytes[0] !== 4 || publicBytes.byteLength !== 65) {
      return false;
    }
    const publicKey = await crypto.subtle.importKey(
      "raw",
      publicBytes,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      {
        crv: "P-256",
        d: privateKeyValue,
        ext: true,
        key_ops: ["sign"],
        kty: "EC",
        x: encodeBase64Url(publicBytes.slice(1, 33)),
        y: encodeBase64Url(publicBytes.slice(33, 65)),
      },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
    const challenge = new TextEncoder().encode("VAPID configuration check");
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      challenge
    );
    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signature,
      challenge
    );
  } catch {
    return false;
  }
};

/** Parse and cryptographically verify a complete VAPID keypair and subject.
 * @param environment - Worker environment containing VAPID values.
 * @returns Valid configuration, or `null` when values are missing or invalid.
 */
export const readVapidConfiguration = async (
  environment: VapidEnvironment
): Promise<VapidConfiguration | null> => {
  const parsed = VapidConfigurationSchema.safeParse({
    privateKey: environment.VAPID_PRIVATE_KEY,
    publicKey: environment.VAPID_PUBLIC_KEY,
    subject: environment.VAPID_SUBJECT,
  });
  if (!parsed.success) {
    return null;
  }
  if (
    !(await matchesVapidKeyPair(parsed.data.privateKey, parsed.data.publicKey))
  ) {
    return null;
  }
  return parsed.data;
};

/** Build and send one encrypted Web Push request while leaving response policy to the caller.
 * @param input - Subscription, payload, VAPID configuration, and TTL.
 * @param fetcher - Fetch implementation used to send the request.
 * @returns The push service's HTTP response.
 */
export const sendWebPush = async (
  input: {
    readonly subscription: WebPushSubscription;
    readonly payload: string;
    readonly vapid: VapidConfiguration;
    readonly ttl: number;
  },
  fetcher: typeof fetch = fetch
): Promise<Response> => {
  const subscription = {
    ...input.subscription,
    expirationTime: input.subscription.expirationTime ?? null,
  } satisfies Block65PushSubscription;
  const request = await buildPushPayload(
    { data: input.payload, options: { ttl: input.ttl } },
    subscription,
    input.vapid
  );
  return fetcher(input.subscription.endpoint, {
    ...request,
    redirect: "manual",
  });
};
