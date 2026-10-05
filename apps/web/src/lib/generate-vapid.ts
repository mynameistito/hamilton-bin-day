import { generateVapidKeyPair } from "./vapid-keypair";

const keyPair = await generateVapidKeyPair();

console.warn(
  "Keep the private key secret. These values are printed only; they have not been saved to a file."
);
console.log(`VAPID_PUBLIC_KEY=${keyPair.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keyPair.privateKey}`);
