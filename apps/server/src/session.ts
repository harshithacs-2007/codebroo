import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function makeSessionToken(secret: string, learnerId: string): string {
  const body = `${learnerId}.${Date.now()}`;
  return `${body}.${sign(secret, body)}`;
}

export function readSessionToken(secret: string, token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, ts, sig] = parts;
  if (!id || !ts || !sig) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
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
