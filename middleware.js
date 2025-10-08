// middleware.js (root of repo, same level as package.json)
import { NextResponse } from "next/server";

export function middleware() {
  return new NextResponse("Hello from YOUR middleware 👋", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Test"' },
  });
}

export const config = {
  // run on everything except Next internals & common assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};