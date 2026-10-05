/** Generated VAPID values in the wire formats used by PushManager and Block65. */
export interface GeneratedVapidKeyPair {
  readonly publicKey: string;
  readonly privateKey: string;
}

/** Encode bytes as unpadded base64url for Web Push configuration. */
export const encodeBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
};

/** Generate an ECDSA P-256 VAPID keypair using the Web Crypto API. */
export const generateVapidKeyPair = async (
  cryptoApi: Crypto = crypto
): Promise<GeneratedVapidKeyPair> => {
  const keyPair = await cryptoApi.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicBytes = new Uint8Array(
    await cryptoApi.subtle.exportKey("raw", keyPair.publicKey)
  );
  const privateJwk = await cryptoApi.subtle.exportKey(
    "jwk",
    keyPair.privateKey
  );
  if (publicBytes.byteLength !== 65 || publicBytes[0] !== 4 || !privateJwk.d) {
    throw new Error("Web Crypto returned an invalid P-256 VAPID keypair");
  }
  return {
    publicKey: encodeBase64Url(publicBytes),
    privateKey: privateJwk.d,
  };
};
