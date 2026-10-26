import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "aurabelle_admin_session";
const sessionLifetimeSeconds = 60 * 60 * 8;

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export function isValidAdminAccessCode(accessCode: string) {
  const secret = getSecret();
  if (!secret) return false;

  const expected = createHash("sha256").update(secret).digest();
  const actual = createHash("sha256").update(accessCode).digest();
  return timingSafeEqual(expected, actual);
}

export function createAdminSessionToken() {
  const secret = getSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters");

  const expiresAt = String(Math.floor(Date.now() / 1000) + sessionLifetimeSeconds);
  const signature = createHmac("sha256", secret).update(expiresAt).digest("base64url");
  return { value: `${expiresAt}.${signature}`, expiresAt: Number(expiresAt) };
}

export function isValidAdminSessionToken(token: string | undefined) {
  const secret = getSecret();
  if (!secret || !token) return false;

  const [expiresAt, signature, extra] = token.split(".");
  if (!expiresAt || !signature || extra || !/^\d+$/.test(expiresAt) || Number(expiresAt) <= Date.now() / 1000) return false;

  const expected = createHmac("sha256", secret).update(expiresAt).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(expected, actual);
}

export async function isAdminAuthenticated() {
  const token = (await cookies()).get(cookieName)?.value;
  return isValidAdminSessionToken(token);
}

export const adminSessionCookie = cookieName;
export const adminSessionLifetimeSeconds = sessionLifetimeSeconds;