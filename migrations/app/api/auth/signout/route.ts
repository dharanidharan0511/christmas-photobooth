/**
 * Sign-out Route Handler.
 *
 * POST /api/auth/signout → clears the admin key cookie (if present).
 * The SSO session cookie is managed by the engine; we can't clear it here,
 * but we can set the local-signout flag via the response so the client
 * knows to stop polling whoami.
 */

import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  // Clear the admin key cookie set by /api/auth/admin-key.
  cookieStore.delete("tp-web:admin-key");
  return NextResponse.json({ ok: true });
}
