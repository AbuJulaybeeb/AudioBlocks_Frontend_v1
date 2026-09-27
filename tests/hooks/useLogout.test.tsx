import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Cookies from 'js-cookie';
import { toast } from 'sonner';
import { useLogout, clearAuthSessionArtifacts } from '@/hooks/useLogout';
import { AUTH } from '@/lib/constants';

const mockPush = vi.fn();
const mockHandleLogOut = vi.fn();
const mockPrivyLogout = vi.fn();
const mockWagmiDisconnect = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@dynamic-labs/sdk-react-core', () => ({
  useDynamicContext: () => ({
    handleLogOut: mockHandleLogOut,
  }),
}));

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    logout: mockPrivyLogout,
  }),
}));

vi.mock('wagmi', () => ({
  useDisconnect: () => ({
    disconnect: mockWagmiDisconnect,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useLogout (#468)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    localStorage.clear();
  });

  it('clears client cookies, server session, and triggers providers on logout', async () => {
    Cookies.set(AUTH.COOKIE_NAME, 'fake_token');
    Cookies.set(AUTH.REFRESH_COOKIE_NAME, 'fake_refresh_token');
    localStorage.setItem('audioblocks_wallet_connected', 'true');

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current.logout({ redirectTo: '/', showToast: true });
    });

    // Cookies cleared
    expect(Cookies.get(AUTH.COOKIE_NAME)).toBeUndefined();
    expect(Cookies.get(AUTH.REFRESH_COOKIE_NAME)).toBeUndefined();

    // Server session endpoint called
    expect(global.fetch).toHaveBeenCalledWith('/api/session', { method: 'DELETE' });

    // Local storage cleared
    expect(localStorage.getItem('audioblocks_wallet_connected')).toBeNull();

    // Provider logouts called
    expect(mockWagmiDisconnect).toHaveBeenCalled();
    expect(mockPrivyLogout).toHaveBeenCalled();
    expect(mockHandleLogOut).toHaveBeenCalled();

    // Toast and router redirect
    expect(toast.success).toHaveBeenCalledWith('Logged out successfully');
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('supports custom redirect and suppressing toast', async () => {
    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current.logout({ redirectTo: '/login', showToast: false });
    });

    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('clearAuthSessionArtifacts handles deletion without throwing', async () => {
    Cookies.set(AUTH.COOKIE_NAME, 'test_val');
    await clearAuthSessionArtifacts();
    expect(Cookies.get(AUTH.COOKIE_NAME)).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith('/api/session', { method: 'DELETE' });
  });
});
