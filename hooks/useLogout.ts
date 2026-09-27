'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { usePrivy } from '@privy-io/react-auth';
import Cookies from 'js-cookie';
import { toast } from 'sonner';
import { useDisconnect } from 'wagmi';
import { AUTH } from '@/lib/constants';

export interface LogoutOptions {
  /** Target path to redirect after logout. Defaults to '/' */
  redirectTo?: string;
  /** Whether to display a toast notification upon successful logout. Defaults to true. */
  showToast?: boolean;
}

/**
 * Clears client-side auth cookies and storage artifacts.
 */
export async function clearAuthSessionArtifacts(): Promise<void> {
  Cookies.remove(AUTH.COOKIE_NAME, { path: '/' });
  Cookies.remove(AUTH.REFRESH_COOKIE_NAME, { path: '/' });
  Cookies.remove('audioblocks_jwt', { path: '/' });

  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('audioblocks_wallet_connected');
    } catch {
      // Storage access might be restricted in some environments; ignore gracefully
    }
  }

  // Clear server-side HttpOnly session cookie (#277)
  try {
    await fetch('/api/session', { method: 'DELETE' });
  } catch {
    // Non-fatal: even if this fails, the readable client cookies are removed
  }
}

/**
 * Unified logout hook (#468) for the Privy Authentication (Frontend) initiative.
 *
 * Coordinates session destruction across:
 *  • Privy React SDK (`logout()`)
 *  • Dynamic Labs SDK (`handleLogOut()`)
 *  • Wagmi wallet connector (`disconnect()`)
 *  • Client-readable JWT cookies (`audioblocks_jwt`, refresh token)
 *  • Server HttpOnly session cookie (`DELETE /api/session`)
 *  • LocalStorage wallet connection state
 */
export function useLogout() {
  let router: { push: (url: string) => void } | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    router = null;
  }

  const { handleLogOut: dynamicLogOut } = useDynamicContext();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  let privyLogout: (() => Promise<void>) | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const privy = usePrivy();
    privyLogout = privy.logout;
  } catch {
    privyLogout = null;
  }

  const logout = useCallback(
    async (options?: LogoutOptions) => {
      const { redirectTo = '/', showToast = true } = options ?? {};
      setIsLoggingOut(true);

      try {
        await clearAuthSessionArtifacts();

        try {
          wagmiDisconnect?.();
        } catch {
          // Ignore wagmi disconnect issues
        }

        if (privyLogout) {
          try {
            await privyLogout();
          } catch {
            // Ignore Privy logout issues
          }
        }

        if (dynamicLogOut) {
          try {
            await dynamicLogOut();
          } catch {
            // Ignore Dynamic logout issues
          }
        }

        if (showToast) {
          toast.success('Logged out successfully');
        }

        if (redirectTo) {
          if (router) {
            router.push(redirectTo);
          } else if (typeof window !== 'undefined') {
            window.location.assign(redirectTo);
          }
        }
      } catch (err) {
        console.error('Logout error:', err);
      } finally {
        setIsLoggingOut(false);
      }
    },
    [dynamicLogOut, privyLogout, wagmiDisconnect, router]
  );

  return { logout, isLoggingOut };
}

export default useLogout;
