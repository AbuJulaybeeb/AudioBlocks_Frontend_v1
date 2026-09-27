'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { usePrivy } from '@privy-io/react-auth';
import Cookies from 'js-cookie';
import { ArrowLeft, Lock } from 'lucide-react';
import ConnectWalletPrompt from '@/components/auth/ConnectWalletPrompt';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { WalletConnectButtons } from '@/components/auth/WalletConnectButtons';
import { AUTH } from '@/lib/constants';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/dashboard';

  const { user } = useDynamicContext();
  let privyAuthenticated = false;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const privy = usePrivy();
    privyAuthenticated = !!privy.authenticated;
  } catch {
    // ignore
  }

  const hasCookie =
    typeof document !== 'undefined' &&
    !!(Cookies.get(AUTH.COOKIE_NAME) || Cookies.get(AUTH.SESSION_COOKIE_NAME));

  const isAuthenticated = !!user?.userId || privyAuthenticated || hasCookie;
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(returnTo);
    }
  }, [isAuthenticated, returnTo, router]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-[#121212] border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl relative">
        <Link
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition"
          href="/"
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#D2045B]/20 text-[#D2045B] mb-4">
            <Lock size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Sign in to AudioBlocks</h1>
          <p className="text-sm text-gray-400 mt-2">
            Connect your wallet or social account to continue to your music dashboard.
          </p>
        </div>

        <div className="space-y-4">
          <button
            className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-[#D2045B] hover:bg-[#B8043F] text-white font-semibold text-sm transition shadow-lg"
            type="button"
            onClick={() => setIsPromptOpen(true)}
          >
            Connect Wallet
          </button>

          <WalletConnectButtons className="w-full" onLoginStart={() => setIsPromptOpen(false)} />

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#121212] px-2 text-gray-500">Or continue with</span>
            </div>
          </div>

          <SocialLoginButtons />
        </div>

        <ConnectWalletPrompt open={isPromptOpen} onClose={() => setIsPromptOpen(false)} />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-gray-400">
          Loading login...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
