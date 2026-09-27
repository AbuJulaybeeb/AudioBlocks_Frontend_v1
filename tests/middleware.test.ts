import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import middleware from '@/middleware';
import { AUTH } from '@/lib/constants';

function createMockRequest(url: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(url, 'http://localhost:3000'), {
    headers: {
      cookie: Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
    },
  });
  return req;
}

const createFakeJwt = (expInSecondsFromNow: number) => {
  const exp = Math.floor(Date.now() / 1000) + expInSecondsFromNow;
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp, sub: 'user_123' }));
  return `${header}.${payload}.signature`;
};

describe('middleware redirect-to-login (#470)', () => {
  it('allows public routes without authentication', () => {
    const req = createMockRequest('http://localhost:3000/');
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it('redirects unauthenticated users from /dashboard to / with returnTo', () => {
    const req = createMockRequest('http://localhost:3000/dashboard');
    const res = middleware(req);

    expect(res.status).toBe(307);
    const redirectLocation = res.headers.get('location');
    expect(redirectLocation).toBeDefined();
    const url = new URL(redirectLocation!);
    expect(url.pathname).toBe('/');
    expect(url.searchParams.get('returnTo')).toBe('/dashboard');
    expect(url.searchParams.get('auth')).toBe('login');
  });

  it('redirects unauthenticated users from /profile with deep query params preserved', () => {
    const req = createMockRequest('http://localhost:3000/profile/edit?tab=settings');
    const res = middleware(req);

    expect(res.status).toBe(307);
    const redirectLocation = res.headers.get('location');
    const url = new URL(redirectLocation!);
    expect(url.searchParams.get('returnTo')).toBe('/profile/edit?tab=settings');
  });

  it('allows access to protected routes when valid session cookie is present', () => {
    const validToken = createFakeJwt(3600);
    const req = createMockRequest('http://localhost:3000/dashboard', {
      [AUTH.SESSION_COOKIE_NAME]: validToken,
    });
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it('allows access to protected routes when valid client JWT cookie is present', () => {
    const validToken = createFakeJwt(3600);
    const req = createMockRequest('http://localhost:3000/dashboard', {
      [AUTH.COOKIE_NAME]: validToken,
    });
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it('allows access when Privy token cookie is present', () => {
    const req = createMockRequest('http://localhost:3000/dashboard', {
      'privy-token': 'privy_session_token_example',
    });
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it('redirects when session token is expired', () => {
    const expiredToken = createFakeJwt(-3600);
    const req = createMockRequest('http://localhost:3000/dashboard', {
      [AUTH.SESSION_COOKIE_NAME]: expiredToken,
    });
    const res = middleware(req);
    expect(res.status).toBe(307);
  });
});
