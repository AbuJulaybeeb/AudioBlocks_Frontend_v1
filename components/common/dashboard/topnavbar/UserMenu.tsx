'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { motion, AnimatePresence } from 'framer-motion';
import Cookies from 'js-cookie';
import { Wallet, User, Repeat, Folder, X } from 'lucide-react';
import { EmbeddedWalletCreator } from '@/components/auth/EmbeddedWalletCreator';
import { WalletConnectButtons } from '@/components/auth/WalletConnectButtons';
import { Auth } from '@/hooks/useAuth';
import { useLogout } from '@/hooks/useLogout';

const UserMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const { user, setShowDynamicUserProfile } = useDynamicContext();
  const { handleLogOut } = Auth();
  const route = useRouter();
  const pathname = usePathname();
  const isAuthenticated = !!user;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  const handlePanelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      toggleRef.current?.focus();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = menuRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }, []);

  const { logout } = useLogout();

  const logOut = async () => {
    setIsOpen(false);
    await logout({ redirectTo: '/' });
  };

  return (
    <div ref={menuRef} className="relative z-50">
      <button
        ref={toggleRef}
        aria-label="Open user menu"
        className="w-8 h-8 rounded-full overflow-hidden border border-gray-700 cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        <Image
          alt="User"
          className="object-cover w-full h-full"
          height={40}
          src="/tech.jpg"
          width={40}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            animate={{ x: 0 }}
            aria-label="User menu"
            aria-modal="true"
            className="fixed top-0 right-0 w-60 h-screen bg-[#111111] shadow-lg border-l border-[#2B2B2B] px-5 py-6 flex flex-col"
            exit={{ x: '100%' }}
            initial={{ x: '100%' }}
            role="dialog"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            onKeyDown={handlePanelKeyDown}
          >
            <button
              ref={closeButtonRef}
              aria-label="Close user menu"
              className="text-[#A3A3A3] cursor-pointer hover:text-white absolute top-4 right-4"
              onClick={() => setIsOpen(false)}
            >
              <X size={22} />
            </button>

            {isAuthenticated ? (
              <>
                <div className="flex items-center truncate border-b pb-3 gap-3 mb-8 mt-2">
                  <Image
                    alt="User Avatar"
                    className="rounded-full"
                    height={50}
                    src="/tech.jpg"
                    width={50}
                  />
                  <div>
                    <p className="font-semibold text-white text-sm">
                      {(user as unknown as Record<string, string>)?.name ||
                        user?.email?.split('@')[0] ||
                        'User'}
                    </p>
                    <p className="text-xs overflow-hidden text-ellipsis text-[#A3A3A3]">
                      {user?.email}
                    </p>
                  </div>
                </div>

                <div className="space-y-6 text-sm text-[#A3A3A3] font-semibold">
                  <Link
                    className="flex items-center gap-3 cursor-pointer hover:text-[#666C6C] transition"
                    href="/dashboard/profile"
                    onClick={() => setIsOpen(false)}
                  >
                    <User />
                    <span>Profile</span>
                  </Link>
                  <button
                    className="flex items-center gap-3 cursor-pointer hover:text-[#666C6C] transition"
                    onClick={() => {
                      setIsOpen(false);
                      setShowDynamicUserProfile(true);
                    }}
                  >
                    <Repeat />
                    <span>Switch Account</span>
                  </button>
                  <Link
                    className="flex items-center gap-3 cursor-pointer hover:text-[#666C6C] transition"
                    href="/dashboard/collection"
                    onClick={() => setIsOpen(false)}
                  >
                    <Folder />
                    <span>My Collections</span>
                  </Link>
                  <div className="flex items-center gap-3 text-gray-400 mt-8">
                    <Wallet />
                    <span>Balance:</span>
                    <span className="font-medium text-[#666C6C]">11000 ABT</span>
                  </div>
                  <EmbeddedWalletCreator />
                  <button
                    className="cursor-pointer hover:text-[#666C6C] transition"
                    onClick={logOut}
                  >
                    Log out
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 gap-6">
                <div className="w-16 h-16 rounded-full bg-[#1A1A1A] flex items-center justify-center">
                  <User className="text-[#A3A3A3]" size={28} />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold mb-1">Welcome</p>
                  <p className="text-xs text-[#A3A3A3]">
                    Connect your wallet to access your dashboard
                  </p>
                </div>
                <WalletConnectButtons className="w-full" onLoginStart={() => setIsOpen(false)} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserMenu;
