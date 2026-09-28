import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const COOKIE_NAME = "kargo_hiring_session";
const SESSION_DURATION = "7d";

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** Verifies the given email/password against the single allowed account. */
export async function verifyCredentials(email: string, password: string): Promise<boolean> {
  const allowedEmail = process.env.AUTH_EMAIL;
  const passwordHash = process.env.AUTH_PASSWORD_HASH;
  if (!allowedEmail || !passwordHash) throw new Error("AUTH_EMAIL / AUTH_PASSWORD_HASH not set");

  if (email.trim().toLowerCase() !== allowedEmail.trim().toLowerCase()) return false;
  return bcrypt.compare(password, passwordHash);
}

export async function createSessionCookie(email: string) {
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** Reads and verifies the session cookie in a Server Component / Route Handler. */
export async function getSession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return { email: payload.email as string };
  } catch {
    return null;
  }
}

/** Same verification, for use in the proxy (middleware) where `cookies()` isn't available. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}

export { COOKIE_NAME };
