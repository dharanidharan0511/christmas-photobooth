/**
 * Engine API Route Handler — SEC-C-001 fix.
 *
 * This handler proxies ALL requests to the engine server-side.
 * ENGINE_URL is a server-only env var (no NEXT_PUBLIC_ prefix) and is
 * NEVER sent to the browser. The browser sees all engine traffic as
 * same-origin /api/engine/... requests.
 *
 * Supports:
 *  - REST (JSON) endpoints
 *  - SSE streaming (text/event-stream) — streamed without buffering
 *  - FormData file uploads
 *  - SSO redirects (_passthrough=1 query param)
 */

import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const ENGINE_URL = process.env["ENGINE_URL"] ?? "";
const CODEFLO_SHARE_KEY = process.env["CODEFLO_SHARE_KEY"] ?? "";

if (!ENGINE_URL && process.env["NODE_ENV"] === "production") {
  // eslint-disable-next-line no-console
  console.error(
    "[engine-proxy] ENGINE_URL is not set. All proxied requests will fail.",
  );
}

/** Headers the proxy must NOT forward upstream (hop-by-hop / Next.js internals). */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

/** Headers to strip from the upstream response before forwarding downstream. */
const STRIP_RESPONSE = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
]);

function buildUpstreamUrl(path: string[], searchParams: URLSearchParams): string {
  const enginePath = "/" + path.join("/");
  const qs = searchParams.toString();
  return `${ENGINE_URL}${enginePath}${qs ? `?${qs}` : ""}`;
}

function forwardRequestHeaders(req: NextRequest, adminKey: string | null): Headers {
  const headers = new Headers();
  for (const [k, v] of req.headers.entries()) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    // Strip Next.js internal headers
    if (k.startsWith("x-nextjs-") || k === "x-forwarded-host") continue;
    headers.set(k, v);
  }
  // Remove the proxy's own admin-key forwarding header — the proxy itself
  // applies the bearer token below, not the browser.
  headers.delete("x-admin-key");

  // Apply engine auth: prefer admin key (from cookie or forwarded header),
  // then fall back to the SSO cookie which is already in `Cookie` header.
  if (adminKey) {
    headers.set("Authorization", `Bearer ${adminKey}`);
  }

  // Rewrite Host to the engine's hostname.
  if (ENGINE_URL) {
    try {
      headers.set("Host", new URL(ENGINE_URL).host);
    } catch {
      // ENGINE_URL not a valid URL — skip Host rewrite.
    }
  }

  return headers;
}

async function readAdminKey(req: NextRequest): Promise<string | null> {
  // 1. Prefer admin key forwarded from the client in x-admin-key header
  //    (set by lib/engineClient.ts when sessionStorage has the key).
  const clientKey = req.headers.get("x-admin-key");
  if (clientKey) return clientKey;

  // 2. Fall back to the HttpOnly admin-key cookie (set by /api/auth/admin-key).
  const cookieStore = await cookies();
  return cookieStore.get("tp-web:admin-key")?.value ?? null;
}

async function handleSsoRedirect(req: NextRequest, path: string[]): Promise<NextResponse> {
  // SSO login is a browser redirect, not an API call. We can't proxy a
  // redirect transparently because the engine redirects to itself (IdP round
  // trip) before coming back. Instead, redirect the browser directly to the
  // engine's SSO URL. This is the one case where we reveal the engine origin
  // to the browser — but only for the IdP redirect flow, and the engine must
  // already be on CORS allow-lists for that.
  const enginePath = "/" + path.join("/");
  const qs = new URLSearchParams(req.nextUrl.searchParams);
  qs.delete("_passthrough");
  const qs2 = qs.toString();
  const redirectUrl = `${ENGINE_URL}${enginePath}${qs2 ? `?${qs2}` : ""}`;
  return NextResponse.redirect(redirectUrl);
}

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse | Response> {
  if (!ENGINE_URL) {
    return NextResponse.json(
      { detail: "Engine URL is not configured on this server." },
      { status: 502 },
    );
  }

  // SSO passthrough — redirect browser directly to engine.
  if (req.nextUrl.searchParams.get("_passthrough") === "1") {
    return handleSsoRedirect(req, path);
  }

  const adminKey = await readAdminKey(req);
  const searchParams = new URLSearchParams(req.nextUrl.searchParams);
  const upstreamUrl = buildUpstreamUrl(path, searchParams);
  const headers = forwardRequestHeaders(req, adminKey);

  // Determine body — pass through for non-GET/HEAD requests.
  let body: BodyInit | null = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      // FormData — fetch from Next.js body, re-send as-is.
      // Remove the content-type header so fetch sets its own boundary.
      headers.delete("content-type");
      body = await req.formData();
    } else {
      body = await req.arrayBuffer();
    }
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body,
      // @ts-expect-error — Node.js fetch supports duplex on streaming bodies
      duplex: "half",
    });
  } catch (err) {
    return NextResponse.json(
      { detail: `Engine unreachable: ${String(err)}` },
      { status: 502 },
    );
  }

  // Build response headers — strip hop-by-hop and CORS (we handle CORS).
  const resHeaders = new Headers();
  for (const [k, v] of upstreamRes.headers.entries()) {
    if (STRIP_RESPONSE.has(k.toLowerCase())) continue;
    resHeaders.set(k, v);
  }

  // SSE streaming — pipe without buffering.
  const isSSE = (upstreamRes.headers.get("content-type") ?? "").includes("text/event-stream");
  if (isSSE && upstreamRes.body) {
    resHeaders.set("Content-Type", "text/event-stream");
    resHeaders.set("Cache-Control", "no-cache, no-transform");
    resHeaders.set("X-Accel-Buffering", "no");
    resHeaders.set("Connection", "keep-alive");

    // Pipe through ReadableStream to avoid buffering.
    const { readable, writable } = new TransformStream();
    void upstreamRes.body.pipeTo(writable);

    return new Response(readable, {
      status: upstreamRes.status,
      headers: resHeaders,
    });
  }

  // Regular JSON / binary response.
  const responseBody = upstreamRes.body;
  return new Response(responseBody, {
    status: upstreamRes.status,
    headers: resHeaders,
  });
}

// Export handlers for all HTTP methods.
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}
