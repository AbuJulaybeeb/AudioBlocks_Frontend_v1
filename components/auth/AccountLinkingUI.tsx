'use client';

import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Mail, CheckCircle2, AlertCircle, Link2, Unlink2, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';

export interface AccountLinkingUIProps {
  className?: string;
  onLinkSuccess?: (email: string) => void;
  onUnlinkSuccess?: () => void;
}

/**
 * Account linking UI allowing users with an existing connected wallet
 * to link (and unlink) their email address via Privy (#471).
 */
export default function AccountLinkingUI({
  className = '',
  onLinkSuccess,
  onUnlinkSuccess,
}: AccountLinkingUIProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Safely invoke usePrivy hook
  let privyData: ReturnType<typeof usePrivy> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    privyData = usePrivy();
  } catch {
    privyData = null;
  }

  const user = privyData?.user;
  const linkEmail = privyData?.linkEmail;
  const unlinkEmail = privyData?.unlinkEmail;

  // Extract linked email and wallet details from Privy user
  const linkedEmailAccount = user?.linkedAccounts?.find(
    (acc): acc is { type: 'email'; address: string; verifiedAt?: number } => acc.type === 'email'
  );
  const userEmail = user?.email?.address || linkedEmailAccount?.address || null;

  const linkedWalletAccount = user?.linkedAccounts?.find(
    (acc): acc is { type: 'wallet'; address: string; walletClientType?: string } =>
      acc.type === 'wallet'
  );
  const userWallet = user?.wallet?.address || linkedWalletAccount?.address || null;

  const handleLinkEmail = async () => {
    setErrorMsg(null);
    if (!linkEmail) {
      const err = 'Privy authentication provider is not initialized.';
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    setLoading(true);
    try {
      await linkEmail();
      toast.success('Email linked to wallet successfully!');
      if (userEmail) {
        onLinkSuccess?.(userEmail);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to link email. Please try again.';
      // Ignore user modal closure / cancellation
      if (message.toLowerCase().includes('cancel') || message.toLowerCase().includes('closed')) {
        toast.info('Email linking cancelled.');
      } else {
        setErrorMsg(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkEmail = async () => {
    if (!userEmail || !unlinkEmail) return;

    setErrorMsg(null);
    setLoading(true);
    try {
      await unlinkEmail(userEmail);
      toast.success('Email unlinked successfully.');
      onUnlinkSuccess?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to unlink email. Please try again.';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="account-linking-ui"
      className={`rounded-xl border border-gray-700 bg-[#1E1E1E] p-5 space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D2045B]/15 text-[#D2045B]">
            <Link2 size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Wallet & Email Account Linking</h3>
            <p className="text-xs text-gray-400">
              Link your email to your connected wallet to enable notifications and account recovery.
            </p>
          </div>
        </div>
      </div>

      {/* Connected Wallet Display */}
      {userWallet && (
        <div className="flex items-center justify-between rounded-lg bg-[#141414] p-3 text-xs border border-gray-800">
          <div className="flex items-center gap-2 text-gray-300">
            <Wallet size={16} className="text-[#D2045B]" />
            <span className="font-medium text-white">Connected Wallet:</span>
            <span className="font-mono text-gray-400">
              {userWallet.slice(0, 6)}...{userWallet.slice(-4)}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <CheckCircle2 size={12} /> Active
          </span>
        </div>
      )}

      {/* Linked Email Display or Link Action */}
      {userEmail ? (
        <div className="flex items-center justify-between rounded-lg bg-[#141414] p-3.5 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <Mail size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{userEmail}</span>
                <span
                  data-testid="email-linked-badge"
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400"
                >
                  <CheckCircle2 size={10} /> Linked
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Notifications and login links are sent to this address.
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="unlink-email-btn"
            disabled={loading}
            onClick={handleUnlinkEmail}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            title="Unlink Email"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Unlink2 size={14} />}
            <span>Unlink</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-[#141414] p-3.5 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-gray-400">
              <Mail size={18} />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-300">No email linked</span>
              <p className="text-xs text-gray-500 mt-0.5">
                Link an email address to manage notifications and secure your music royalties.
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="link-email-btn"
            disabled={loading}
            onClick={handleLinkEmail}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#D2045B] hover:bg-[#b0034c] px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 shadow-md shadow-[#D2045B]/20"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Mail size={14} />
                <span>Link Email</span>
              </>
            )}
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          data-testid="account-linking-error"
          className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400"
        >
          <AlertCircle size={14} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
