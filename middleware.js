// middleware.js (root)
import { NextResponse } from 'next/server';

export const config = {
  // protect everything except Next static assets & a few common public files
  matcher: ['/((?!_next/|favicon.ico|robots.txt|sitemap.xml|assets/).*)'],
};

export function middleware(req) {
  // Optional flag: only enable if set to "1"
  const enabled = process.env.NEXT_PUBLIC_ENABLE_BASIC_AUTH === '1';

  const USER = process.env.BASIC_AUTH_USER || '';
  const PASS = process.env.BASIC_AUTH_PASS || '';
  const REALM = process.env.BASIC_AUTH_REALM || 'Restricted';

  // If disabled or creds not set, let traffic through
  if (!enabled || !USER || !PASS) {
    return NextResponse.next();
  }

  const auth = req.headers.get('authorization');

  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic') {
      const [u, p] = atob(encoded).split(':');
      if (u === USER && p === PASS) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}