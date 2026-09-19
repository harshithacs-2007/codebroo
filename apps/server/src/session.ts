import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function makeSessionToken(secret: string, learnerId: string, now = Date.now()): string {
  const body = `${learnerId}.${now}`;
  return `${body}.${sign(secret, body)}`;
}

export function readSessionToken(
  secret: string,
  token: string | undefined,
  now = Date.now(),
  maxAgeMs = SESSION_TTL_MS,
): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, ts, sig] = parts;
  if (!id || !ts || !sig) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  if (!/^\d+$/.test(ts)) return null;

  const issuedAt = Number(ts);
  if (!Number.isSafeInteger(issuedAt)) return null;
  if (issuedAt > now + 2 * 60 * 1000) return null;
  if (now - issuedAt > maxAgeMs) return null;

  const body = `${id}.${ts}`;
  const expected = sign(secret, body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return id;
}

export function newLearnerId(): string {
  return randomBytes(16).toString("hex");
}

export { SESSION_TTL_MS };
