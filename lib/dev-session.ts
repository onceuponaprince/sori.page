import type { NextRequest } from "next/server";
import { isSuperAdminBypassEnabled } from "@/lib/admin-auth";

export const DEV_SESSION_COOKIE = "sori_dev_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

function getSigningSecret(): string {
  const secret =
    process.env.SUPER_ADMIN_PASSWORD ||
    process.env.DJANGO_SECRET_KEY ||
    "";
  if (!secret) {
    throw new Error("Missing dev session signing secret");
  }
  return secret;
}

async function signPayload(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSigningSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return Buffer.from(signature).toString("base64url");
}

export async function createDevSessionToken(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = `${normalized}|${exp}`;
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${await signPayload(payload)}`;
}

export async function verifyDevSessionToken(
  token: string | undefined,
): Promise<string | null> {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = await signPayload(payload);
  if (signature.length !== expected.length) {
    return null;
  }

  let mismatch = 0;
  for (let i = 0; i < signature.length; i += 1) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) {
    return null;
  }

  const [email, expRaw] = payload.split("|");
  const exp = Number(expRaw);
  if (!email || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return email;
}

export function isDevSessionAllowed(): boolean {
  return (
    isSuperAdminBypassEnabled() &&
    process.env.NODE_ENV !== "production"
  );
}

export function devSessionUserId(email: string): string {
  return `dev-session:${email.trim().toLowerCase()}`;
}

export async function getDevSessionEmailFromRequest(
  req: NextRequest,
): Promise<string | null> {
  if (!isDevSessionAllowed()) {
    return null;
  }

  return verifyDevSessionToken(req.cookies.get(DEV_SESSION_COOKIE)?.value);
}

export async function getDevSessionContextFromRequest(
  req: NextRequest,
): Promise<{ userId: string; email: string } | null> {
  const email = await getDevSessionEmailFromRequest(req);
  if (!email) {
    return null;
  }

  return { userId: devSessionUserId(email), email };
}

export async function devSessionCookieOptions(email: string) {
  return {
    name: DEV_SESSION_COOKIE,
    value: await createDevSessionToken(email),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export function isSupabaseNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const cause = (error as Error & { cause?: unknown }).cause;
  const causeMessage =
    cause instanceof Error ? cause.message.toLowerCase() : "";

  return (
    message.includes("fetch failed") ||
    message.includes("getaddrinfo") ||
    message.includes("eai_again") ||
    message.includes("enotfound") ||
    message.includes("network") ||
    causeMessage.includes("getaddrinfo") ||
    causeMessage.includes("eai_again") ||
    causeMessage.includes("enotfound")
  );
}
