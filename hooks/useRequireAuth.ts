'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { usePrivy } from '@privy-io/react-auth';
import Cookies from 'js-cookie';
import { AUTH } from '@/lib/constants';

export interface UseRequireAuthOptions {
  /** Target login redirect path. Defaults to '/' */
  loginPath?: string;
  /** Custom destination after login. Defaults to current path */
  returnTo?: string;
}

/**
 * Hook to enforce authentication on client-side routes and components (#470).
 *
 * Checks authentication across:
 *  • Dynamic Labs context (`user.userId`)
 *  • Privy React SDK (`authenticated`)
 *  • AudioBlocks auth cookies (`audioblocks_jwt`, `audioblocks_session`)
 *
 * If unauthenticated, redirects to the login path while preserving
 * the return destination via `returnTo`.
 */
export function useRequireAuth(options?: UseRequireAuthOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const { user: dynamicUser } = useDynamicContext();
  const [isClientReady, setIsClientReady] = useState(false);

  let privyAuthenticated = false;
  let privyReady = true;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const privy = usePrivy();
    privyAuthenticated = !!privy.authenticated;
    privyReady = privy.ready ?? true;
  } catch {
    // Privy not mounted or unavailable in current tree
  }

  const hasCookieAuth =
    typeof document !== 'undefined' &&
    !!(Cookies.get(AUTH.COOKIE_NAME) || Cookies.get(AUTH.SESSION_COOKIE_NAME));

  const isAuthenticated = !!dynamicUser?.userId || privyAuthenticated || hasCookieAuth;

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  useEffect(() => {
    if (!isClientReady || !privyReady) return;

    if (!isAuthenticated) {
      const loginPath = options?.loginPath ?? '/';
      const currentQuery = typeof window !== 'undefined' ? window.location.search : '';
      const targetReturnTo = options?.returnTo ?? `${pathname}${currentQuery}`;
      const url = new URL(loginPath, window.location.origin);
      url.searchParams.set('returnTo', targetReturnTo || '/dashboard');
      url.searchParams.set('auth', 'login');

      router.replace(`${url.pathname}${url.search}`);
    }
  }, [
    isClientReady,
    privyReady,
    isAuthenticated,
    pathname,
    router,
    options?.loginPath,
    options?.returnTo,
  ]);

  return {
    isAuthenticated,
    isLoading: !isClientReady || !privyReady,
  };
}

export default useRequireAuth;
