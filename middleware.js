// /middleware.js
import { NextResponse } from "next/server";

// Explicit matcher so middleware runs on everything except these paths
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|lock|api/unlock|public).*)',
  ],
};

export function middleware(req) {
  const passcode = process.env.SITE_LOCK_PASSCODE;
  // If no passcode set, do not lock the site (useful locally)
  if (!passcode) return NextResponse.next();

  const cookie = req.cookies.get('site_lock')?.value;
  if (cookie === passcode) return NextResponse.next();

  // Not unlocked — send to /lock
  const url = req.nextUrl.clone();
  url.pathname = '/lock';
  return NextResponse.redirect(url);
}