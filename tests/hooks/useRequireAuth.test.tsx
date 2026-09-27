import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Cookies from 'js-cookie';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { AUTH } from '@/lib/constants';

const mockReplace = vi.fn();
let mockDynamicUser: { userId?: string } | null = null;
let mockPrivyAuthenticated = false;

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => '/dashboard/profile',
}));

vi.mock('@dynamic-labs/sdk-react-core', () => ({
  useDynamicContext: () => ({
    user: mockDynamicUser,
  }),
}));

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    authenticated: mockPrivyAuthenticated,
    ready: true,
  }),
}));

describe('useRequireAuth (#470)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDynamicUser = null;
    mockPrivyAuthenticated = false;
    Cookies.remove(AUTH.COOKIE_NAME);
    Cookies.remove(AUTH.SESSION_COOKIE_NAME);
  });

  it('redirects unauthenticated users to login with returnTo', () => {
    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isAuthenticated).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('/?returnTo=%2Fdashboard%2Fprofile&auth=login')
    );
  });

  it('does not redirect if user is authenticated via Dynamic', () => {
    mockDynamicUser = { userId: 'user-123' };

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect if user is authenticated via Privy', () => {
    mockPrivyAuthenticated = true;

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect if user has valid auth cookie', () => {
    Cookies.set(AUTH.COOKIE_NAME, 'valid.jwt.token');

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('supports custom login path and returnTo target', () => {
    const { result } = renderHook(() =>
      useRequireAuth({ loginPath: '/login', returnTo: '/dashboard/settings' })
    );

    expect(result.current.isAuthenticated).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith('/login?returnTo=%2Fdashboard%2Fsettings&auth=login');
  });
});
