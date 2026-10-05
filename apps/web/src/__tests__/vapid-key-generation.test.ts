import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import { encodeBase64Url, generateVapidKeyPair } from "@/lib/vapid-keypair";

describe("VAPID key generation utility", () => {
  it("encodes bytes as unpadded base64url", () => {
    expect(encodeBase64Url(Uint8Array.from([1, 2, 3, 251, 255]))).toBe(
      "AQID-_8"
    );
  });

  it("generates mutually matching P-256 public and private VAPID values", async () => {
    const pair = await generateVapidKeyPair();
    expect(pair.publicKey).toMatch(/^[A-Za-z0-9_-]{87}$/u);
    expect(pair.privateKey).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    const publicBytes = Buffer.from(pair.publicKey, "base64url");

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
        d: pair.privateKey,
        ext: true,
        key_ops: ["sign"],
        kty: "EC",
        x: publicBytes.subarray(1, 33).toString("base64url"),
        y: publicBytes.subarray(33, 65).toString("base64url"),
      },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
    const challenge = new TextEncoder().encode("key-generation-test");
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      challenge
    );
    await expect(
      crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        publicKey,
        signature,
        challenge
      )
    ).resolves.toBeTruthy();
  });
});
