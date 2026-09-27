'use client';

// #461 — PrivyAuthProvider wraps the app in <PrivyProvider> with the project
// app config so that usePrivy() and other Privy hooks work throughout the tree.
//
// Configuration:
//   NEXT_PUBLIC_PRIVY_APP_ID  — required; obtain from https://dashboard.privy.io
//
// Login methods enabled:
//   • Email (OTP)
//   • Google OAuth

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

export default function PrivyAuthProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'google'],
        appearance: {
          theme: 'dark',
          accentColor: '#7c3aed', // AudioBlocks brand violet
          logo: '/images/logo.svg',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
