// middleware.js
import { NextResponse, NextRequest } from "next/server";

const ENABLED =
  process.env.ENABLE_BASIC_AUTH || process.env.NEXT_PUBLIC_ENABLE_BASIC_AUTH;
const USER = process.env.BASIC_AUTH_USER || "";
const PASS = process.env.BASIC_AUTH_PASS || "";

export function middleware(req /** @type {NextRequest} */) {
  // If disabled, let everything through
  if (!ENABLED) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Allow assets and common files (adjust as needed)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    pathname.startsWith("/api/health")
  ) {
    return NextResponse.next();
  }

  const header = req.headers.get("authorization") || "";
  const [scheme, encoded] = header.split(" ");

  if (scheme === "Basic" && encoded) {
    // Edge runtime has atob()
    const decoded = atob(encoded);
    const [u, p] = decoded.split(":");
    if (u === USER && p === PASS) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Protected", charset="UTF-8"',
    },
  });
}

export const config = {
  // Protect everything except Next internals & a few files
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};