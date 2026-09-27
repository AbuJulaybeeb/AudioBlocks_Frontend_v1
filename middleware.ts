// #138 — Middleware guards all dashboard and profile routes.
// Previous version only checked /dashboard and redirected to / with no return
// URL, meaning users had to navigate back manually after login.
//
// Fixes:
//  • /profile routes are now protected (added to matcher and check)
//  • Redirect target is /login (not /) so the login page receives the intent
//  • `returnTo` query param preserves the original URL for post-login redirect
//  • Expired JWTs are detected by checking the `exp` claim in the cookie value
//    so stale tokens don't grant access to protected pages
//  • #478 — /onboarding is also gated so only authenticated users reach it;
//    guests are sent to the landing page with a returnTo back to onboarding.

import { NextRequest, NextResponse } from 'next/server';
import { AUTH } from '@/lib/constants';

const PROTECTED_PREFIXES = ['/dashboard', '/profile', '/onboarding'];
const LOGIN_PATH = '/';

function isExpiredJwt(tokenValue: string): boolean {
  try {
    const parts = tokenValue.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (typeof payload.exp !== 'number') return false;
    return Date.now() / 1000 > payload.exp;
  } catch {
    return true;
  }
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  // #277, #470 — read HttpOnly session cookie, fallback to client JWT cookie,
  // or Privy authentication cookies.
  const sessionCookie = req.cookies.get(AUTH.SESSION_COOKIE_NAME);
  const jwtCookie = req.cookies.get(AUTH.COOKIE_NAME);
  const privyCookie =
    req.cookies.get('privy-token') ||
    req.cookies.get('privy-id-token') ||
    req.cookies.get('privy-session');

  const hasValidSession = !!(sessionCookie && !isExpiredJwt(sessionCookie.value));
  const hasValidJwt = !!(jwtCookie && !isExpiredJwt(jwtCookie.value));
  const hasPrivyAuth = !!privyCookie;

  const isAuthenticated = hasValidSession || hasValidJwt || hasPrivyAuth;

  if (!isAuthenticated) {
    const loginUrl = new URL(LOGIN_PATH, req.url);
    const returnTarget = `${pathname}${req.nextUrl.search || ''}`;
    loginUrl.searchParams.set('returnTo', returnTarget);
    loginUrl.searchParams.set('auth', 'login');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Literal array required — Next.js extracts this at build time (#138).
  matcher: ['/dashboard/:path*', '/profile/:path*', '/onboarding'],
};
