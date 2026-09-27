'use client';

import { ReactNode } from 'react';
import { useRequireAuth, type UseRequireAuthOptions } from '@/hooks/useRequireAuth';

export interface AuthGuardProps extends UseRequireAuthOptions {
  children: ReactNode;
  /** Custom fallback element to show while validating auth or redirecting */
  fallback?: ReactNode;
}

/**
 * Component-level auth guard (#470) for the Privy Authentication initiative.
 *
 * Ensures children are only rendered for authenticated users. Unauthenticated
 * visitors are automatically redirected to the login flow with returnTo set.
 */
export function AuthGuard({ children, fallback = null, loginPath, returnTo }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useRequireAuth({ loginPath, returnTo });

  if (isLoading || !isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default AuthGuard;
