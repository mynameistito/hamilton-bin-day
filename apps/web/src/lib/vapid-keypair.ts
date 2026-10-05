/** Generated VAPID values in the wire formats used by PushManager and Block65. */
export interface GeneratedVapidKeyPair {
  readonly publicKey: string;
  readonly privateKey: string;
}

/** Encode bytes as unpadded base64url for Web Push configuration.
 * @param bytes - Binary value to encode.
 * @returns The base64url representation without padding.
 */
export const encodeBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  const encoded = btoa(binary).replaceAll("+", "-").replaceAll("/", "_");
  return encoded.split("=")[0] ?? "";
};

/** Generate an ECDSA P-256 VAPID keypair using the Web Crypto API.
 * @param cryptoApi - Web Crypto implementation to use.
 * @returns The public and private keys in VAPID wire formats.
 */
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
