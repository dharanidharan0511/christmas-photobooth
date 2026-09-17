/**
 * Admin Key Auth Route Handler — SEC-H-001 fix.
 *
 * POST /api/auth/admin-key  → store admin key as HttpOnly cookie
 * DELETE /api/auth/admin-key → clear the cookie
 *
 * The admin key never needs to be in localStorage or accessible to JS.
 * The engine proxy reads it from the cookie server-side.
 */

import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "tp-web:admin-key";
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
  // Secure should be true in production; the middleware or deployment
  // config must enforce HTTPS.
  secure: process.env["NODE_ENV"] === "production",
};

export async function POST(req: NextRequest) {
  let key: string;
  try {
    const body = (await req.json()) as { key?: unknown };
    if (typeof body.key !== "string" || !body.key.trim()) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }
    key = body.key.trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, key, COOKIE_OPTIONS);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
