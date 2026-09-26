'use client';

import { useUserPreferences } from '@/context/UserPreferencesContext';
import type { AudioQuality } from '@/context/UserPreferencesContext';
import AccountLinkingUI from '@/components/auth/AccountLinkingUI';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import Link from 'next/link';
import { Mail, Wallet, Trash2 } from 'lucide-react';

function LinkedAccountsList() {
  const { user, handleUnlinkWallet } = useDynamicContext();
  const linkedWallets = user?.verifiedCredentials?.filter((cred) => cred.format === 'wallet') || [];
  const linkedEmails = user?.verifiedCredentials?.filter((cred) => cred.format === 'email') || [];

  return (
    <>
      {linkedWallets.map((wallet) => (
        <div
          key={wallet.id}
          className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-[#1E1E1E]"
        >
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-gray-400" />
            <div>
              <div className="font-medium text-white">{wallet.walletName || 'Wallet'}</div>
              <div className="text-xs text-gray-400 mt-1">
                {wallet.address && `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
              </div>
            </div>
          </div>
          <button
            className="text-red-500 hover:text-red-400 p-2 rounded-full hover:bg-red-500/10 transition-colors"
            onClick={() => handleUnlinkWallet(wallet.id)}
            title="Unlink Wallet"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {linkedEmails.map((emailCred) => (
        <div
          key={emailCred.id}
          className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-[#1E1E1E]"
        >
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-gray-400" />
            <div>
              <div className="font-medium text-white">Email</div>
              <div className="text-xs text-gray-400 mt-1">{emailCred.email}</div>
            </div>
          </div>
          {/* Note: Unlinking email might be different or not supported depending on Dynamic configuration, but we can provide the UI if it has an ID and handleUnlinkWallet handles it, or just show it */}
        </div>
      ))}
      {linkedWallets.length === 0 && linkedEmails.length === 0 && (
        <div className="text-sm text-gray-400">No linked accounts found.</div>
      )}
    </>
  );
}

const QUALITY_OPTIONS: { value: AudioQuality; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto', description: 'Adapt quality based on your connection speed' },
  { value: 'low', label: 'Low', description: 'Uses less data, lower audio fidelity' },
  { value: 'medium', label: 'Medium', description: 'Balanced quality and data usage' },
  { value: 'high', label: 'High', description: 'Best audio quality, uses more data' },
];

export default function SettingsPage() {
  const { preferences, setPreference } = useUserPreferences();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">Linked Accounts</h2>
        <p className="text-sm text-gray-400 mb-4">
          Manage the wallets and identities connected to your account.
        </p>
        <div className="space-y-4">
          <AccountLinkingUI />
          <LinkedAccountsList />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">Audio Quality</h2>
        <p className="text-sm text-gray-400 mb-4">
          Choose the default audio streaming quality for your playback experience.
        </p>
        <div className="grid gap-3">
          {QUALITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                preferences.audioQuality === option.value
                  ? 'border-[#D2045B] bg-[#D2045B]/10 text-white'
                  : 'border-gray-700 bg-[#1E1E1E] text-gray-300 hover:border-gray-500'
              }`}
              onClick={() => setPreference('audioQuality', option.value)}
            >
              <div className="text-left">
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-400 mt-1">{option.description}</div>
              </div>
              {preferences.audioQuality === option.value && (
                <div className="h-3 w-3 rounded-full bg-[#D2045B]" />
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">Playback</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-[#1E1E1E]">
            <div>
              <div className="font-medium text-white">Autoplay</div>
              <div className="text-xs text-gray-400 mt-1">
                Automatically play the next track when the current one ends
              </div>
            </div>
            <button
              aria-label={`Autoplay is ${preferences.autoplay ? 'on' : 'off'}`}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.autoplay ? 'bg-[#D2045B]' : 'bg-gray-600'
              }`}
              onClick={() => setPreference('autoplay', !preferences.autoplay)}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.autoplay ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-[#1E1E1E]">
            <div>
              <div className="font-medium text-white">Show Explicit Content</div>
              <div className="text-xs text-gray-400 mt-1">
                Include tracks marked as explicit in recommendations
              </div>
            </div>
            <button
              aria-label={`Explicit content is ${preferences.showExplicitContent ? 'on' : 'off'}`}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.showExplicitContent ? 'bg-[#D2045B]' : 'bg-gray-600'
              }`}
              onClick={() => setPreference('showExplicitContent', !preferences.showExplicitContent)}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.showExplicitContent ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">Quality Checks</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-[#1E1E1E]">
            <div>
              <div className="font-medium text-white">Opt Out of Quality Checks</div>
              <div className="text-xs text-gray-400 mt-1">
                Skip the automated AI quality analysis on your uploads. Existing tracks stay online
                and you can turn this back on at any time.
              </div>
            </div>
            <button
              aria-label={`Quality checks are ${preferences.qualityAnalysisOptOut ? 'off' : 'on'}`}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.qualityAnalysisOptOut ? 'bg-gray-600' : 'bg-[#D2045B]'
              }`}
              onClick={() =>
                setPreference('qualityAnalysisOptOut', !preferences.qualityAnalysisOptOut)
              }
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.qualityAnalysisOptOut ? 'translate-x-1' : 'translate-x-6'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-[#1E1E1E]">
            <div>
              <div className="font-medium text-white flex items-center gap-2">
                Tune Platform Quality Thresholds
                <span className="rounded-full bg-[#D2045B]/15 px-2 py-0.5 text-[10px] font-semibold text-[#D2045B] border border-[#D2045B]/30">
                  Admin
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Configure minimum confidence scores per genre and review adaptive moderation
                feedback.
              </div>
            </div>
            <Link
              href="/dashboard/settings/quality"
              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#D2045B] hover:bg-[#b0034c] rounded-lg transition-colors shrink-0"
            >
              Tune Thresholds
            </Link>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-[#1E1E1E]">
            <div>
              <div className="font-medium text-white">Email Notifications</div>
              <div className="text-xs text-gray-400 mt-1">
                Receive updates and recommendations via email
              </div>
            </div>
            <button
              aria-label={`Email notifications are ${preferences.emailNotifications ? 'on' : 'off'}`}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.emailNotifications ? 'bg-[#D2045B]' : 'bg-gray-600'
              }`}
              onClick={() => setPreference('emailNotifications', !preferences.emailNotifications)}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-[#1E1E1E]">
            <div>
              <div className="font-medium text-white">In-App Notifications</div>
              <div className="text-xs text-gray-400 mt-1">Show notifications within the app</div>
            </div>
            <button
              aria-label={`In-app notifications are ${preferences.inAppNotifications ? 'on' : 'off'}`}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.inAppNotifications ? 'bg-[#D2045B]' : 'bg-gray-600'
              }`}
              onClick={() => setPreference('inAppNotifications', !preferences.inAppNotifications)}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.inAppNotifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
