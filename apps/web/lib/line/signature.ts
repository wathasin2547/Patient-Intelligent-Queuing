import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyLineSignature(
  rawBody: string,
  signature: string | null,
  channelSecret: string,
): boolean {
  if (!signature || !channelSecret) return false;

  const expected = createHmac("sha256", channelSecret)
    .update(rawBody, "utf8")
    .digest();

  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64");
  } catch {
    return false;
  }

  return received.length === expected.length && timingSafeEqual(received, expected);
}