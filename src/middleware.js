// src/middleware.js
import { NextResponse } from 'next/server';

const BASIC_USER = process.env.BASIC_AUTH_USER || '';
const BASIC_PASS = process.env.BASIC_AUTH_PASS || '';
const ENABLED =
  (process.env.ENABLE_BASIC_AUTH || process.env.NEXT_PUBLIC_ENABLE_BASIC_AUTH) === '1';

// Run on ALL routes; we'll skip assets inside the function
export const config = {
  matcher: '/:path*',
};

export default function middleware(req) {
  const { pathname } = req.nextUrl;

  // ✅ Let Next internals and ANYTHING with a dot (.) go straight through
  if (pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  if (!ENABLED || !BASIC_USER || !BASIC_PASS) {
    return NextResponse.next();
  }

  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Basic ')) {
    return new Response('Auth required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
    });
  }

  try {
    const [, b64] = auth.split(' ');
    const [user, pass] = Buffer.from(b64, 'base64').toString().split(':');
    if (user === BASIC_USER && pass === BASIC_PASS) {
      return NextResponse.next();
    }
  } catch {}

  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  });
}