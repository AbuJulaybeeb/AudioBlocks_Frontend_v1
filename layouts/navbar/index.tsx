'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { Variants, motion, AnimatePresence } from 'framer-motion';
import Cookies from 'js-cookie';
import { ArrowRight, Folder, LogOut, Menu, User, X } from 'lucide-react';
import { toast } from 'sonner';
import ConnectWalletPrompt from '@/components/auth/ConnectWalletPrompt';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SearchOverlay } from '@/components/ui/SearchOverlay';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Auth } from '@/hooks/useAuth';
import { useLogout } from '@/hooks/useLogout';

/**
 * True if the visitor has no injected EVM wallet extension at all
 * (e.g. MetaMask, Coinbase Wallet). Dynamic's modal still offers
 * email/social login and WalletConnect in this case, but we surface a
 * friendly hint up front instead of letting them hit a dead end.
 */
function hasInjectedWallet(): boolean {
  if (typeof window === 'undefined') return true;
  return typeof (window as unknown as { ethereum?: unknown }).ethereum !== 'undefined';
}

const navLinks = [
  { name: 'Home', href: '/' },
  { name: 'Artist Hub', href: '/artist-hub' },
  { name: 'Marketplace', href: '/marketPlace' },
  { name: 'Collective', href: '/collective' },
];

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  // Auth() mounts the signature flow and the #476 role-selection listener for
  // every public page; nothing is destructured because the prompt now owns the
  // sign-in trigger UI.
  Auth();
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileCloseRef = useRef<HTMLButtonElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileUserMenuRef = useRef<HTMLDivElement | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const route = useRouter();

  useEffect(() => {
    if (isMenuOpen) {
      mobileCloseRef.current?.focus();
    }
  }, [isMenuOpen]);

  const handleMobileMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsMenuOpen(false);
      return;
    }
    if (e.key === 'Tab') {
      const focusable = mobileMenuRef.current?.querySelectorAll<HTMLElement>(
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

  const { setShowDynamicUserProfile, user } = useDynamicContext();
  const { logout } = useLogout();

  // #476 — open the differentiated listener/artist connect-wallet prompt
  // instead of dropping every visitor into the same Dynamic auth flow.
  const [isWalletPromptOpen, setIsWalletPromptOpen] = useState(false);

  // #470 — If an unauthenticated visitor was redirected to login with returnTo, auto-open the prompt
  useEffect(() => {
    if (typeof window !== 'undefined' && !user?.userId) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('returnTo') || params.get('auth') === 'login') {
        setIsWalletPromptOpen(true);
      }
    }
  }, [user?.userId, pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inDesktopMenu = userMenuRef.current?.contains(target) ?? false;
      const inMobileMenu = mobileUserMenuRef.current?.contains(target) ?? false;
      if (!inDesktopMenu && !inMobileMenu) {
        setIsUserMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [pathname]);

  const avatarInitial = (user?.email?.[0] ?? 'A').toUpperCase();

  const logOut = async () => {
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
    await logout({ redirectTo: '/' });
  };

  const handleAuthentication = async () => {
    if (!hasInjectedWallet()) {
      toast.error(
        'No wallet extension detected. You can still sign in with email below, or install a wallet like MetaMask.',
        {
          action: {
            label: 'Get MetaMask',
            onClick: () => window.open('https://metamask.io/download/', '_blank'),
          },
          duration: 8000,
        }
      );
    }
    setIsWalletPromptOpen(true);
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Utility function for active link styling
  const linkClass = (href: string) =>
    pathname === href
      ? 'text-[#6B4C87] px-6 py-2 rounded-full text-sm font-medium bg-transparent bg-opacity-10 border border-[#6B4C87]'
      : 'text-gray-300 hover:text-white px-6 py-2 text-sm font-medium transition-colors duration-200';

  // Variants for animation
  const menuVariants: Variants = {
    hidden: { x: '100%' },
    visible: {
      x: 0,
      transition: {
        duration: 0.3,
        ease: 'easeInOut',
        when: 'beforeChildren',
        staggerChildren: 0.1,
      },
    },
    exit: {
      x: '100%',
      transition: { duration: 0.3, ease: 'easeInOut' },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.2 } },
  };

  return (
    <nav
      className={`w-full z-30 sticky top-0 py-4 transition-all duration-300 ${
        scrolled ? 'bg-[#0f0f0f]/80 backdrop-blur-lg ' : ''
      }`}
    >
      <div className="flex h-[51px] items-center justify-between py-4 max-w-11/12 mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <Image alt="AudioBlocks Logo" height={100} src="/logo2.png" width={100} />
          <ThemeToggle />
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex bg-[#0F0F0F] rounded-full border border-gray-800 p-1 items-center justify-between">
          <Link className={linkClass('/')} href="/">
            Home
          </Link>
          <Link className={linkClass('/artist-hub')} href="/artist-hub">
            Artist Hub
          </Link>
          <Link className={linkClass('/marketPlace')} href="/marketPlace">
            Marketplace
          </Link>
          <Link className={linkClass('/collective')} href="/collective">
            Collective
          </Link>
        </div>

        {/* Sign In */}
        <div className="hidden md:flex">
          <ConnectWalletPrompt
            open={isWalletPromptOpen}
            onClose={() => setIsWalletPromptOpen(false)}
          />
          {!user?.userId ? (
            <>
              <SocialLoginButtons onLoginStart={() => setShouldTriggerSignature(true)} />
              <button
                className="px-4 cursor-pointer py-2 gap-3 rounded-full bg-[#D2045B] hover:bg-[#B8043F] flex justify-between items-center text-white font-bold transition-all duration-200 whitespace-nowrap text-sm hover:scale-105 shadow-lg hover:shadow-xl"
                onClick={handleAuthentication}
              >
                Sign in
                <div className="bg-black rounded-full p-1">
                  <ArrowRight className="h-4 w-4 rotate-[300deg]" />
                </div>
              </button>
            </>
          ) : (
            <div ref={userMenuRef} className="relative">
              <button
                aria-label="Open account menu"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#D2045B] text-sm font-bold text-white transition-all duration-200 hover:scale-105"
                onClick={() => setIsUserMenuOpen((open) => !open)}
              >
                {avatarInitial}
              </button>
              {isUserMenuOpen && (
                <div className="absolute right-0 top-12 z-50 w-60 rounded-xl border border-gray-800 bg-[#0F0F0F] p-4 shadow-xl">
                  <div className="mb-3 truncate border-b border-gray-800 pb-3">
                    <p className="truncate text-sm font-semibold text-white">{user?.email}</p>
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <Link
                      className="rounded-lg px-3 py-2 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
                      href="/dashboard/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <span className="flex items-center gap-3">
                        <User className="h-4 w-4" />
                        Profile
                      </span>
                    </Link>
                    <Link
                      className="rounded-lg px-3 py-2 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
                      href="/dashboard/collection"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <span className="flex items-center gap-3">
                        <Folder className="h-4 w-4" />
                        My Collections
                      </span>
                    </Link>
                    <button
                      className="cursor-pointer rounded-lg px-3 py-2 text-left text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
                      onClick={logOut}
                    >
                      <span className="flex items-center gap-3">
                        <LogOut className="h-4 w-4" />
                        Log out
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden">
          <button
            className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2045B]"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="h-6 w-6 text-white" />
            ) : (
              <Menu className="h-6 w-6 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Slide-in Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            ref={mobileMenuRef}
            animate="visible"
            aria-label="Navigation menu"
            aria-modal="true"
            className="fixed top-0 right-0 bottom-0 w-4/5 max-w-xs bg-[#000] z-50 shadow-lg border-l border-gray-900"
            exit="exit"
            initial="hidden"
            role="dialog"
            variants={menuVariants}
            onKeyDown={handleMobileMenuKeyDown}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <Image alt="AudioBlocks Logo" height={40} src="/logo2.png" width={40} />
              <button
                ref={mobileCloseRef}
                aria-label="Close navigation menu"
                onClick={() => setIsMenuOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>

            <div className="flex flex-col gap-4 px-6 py-6">
              {navLinks.map(({ name, href }) => (
                <motion.div key={href} variants={itemVariants}>
                  <Link
                    className={`block text-base ${linkClass(href)}`}
                    href={href}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {name}
                  </Link>
                </motion.div>
              ))}

              <motion.div variants={itemVariants}>
                {!user?.userId ? (
                  <>
                    <button
                      className="mt-6 w-full px-4 py-2 rounded-full bg-[#D2045B] hover:bg-[#B8043F] text-white font-medium text-sm flex justify-center items-center gap-2"
                      onClick={handleAuthentication}
                    >
                      Sign in
                      <div className="bg-black rounded-full p-1">
                        <ArrowRight className="h-4 w-4 rotate-[300deg]" />
                      </div>
                    </button>
                    <SocialLoginButtons
                      className="mt-3 justify-center"
                      onLoginStart={() => setShouldTriggerSignature(true)}
                    />
                  </>
                ) : (
                  <div ref={mobileUserMenuRef} className="relative mt-6">
                    <button
                      aria-label="Open account menu"
                      className="w-full px-4 py-2 rounded-full bg-[#D2045B] hover:bg-[#B8043F] text-white font-medium text-sm flex justify-center items-center gap-2"
                      onClick={() => setIsUserMenuOpen((open) => !open)}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs font-bold">
                        {avatarInitial}
                      </span>
                      <span className="max-w-[180px] truncate">{user?.email}</span>
                    </button>
                    {isUserMenuOpen && (
                      <div className="mt-2 rounded-xl border border-gray-800 bg-[#0F0F0F] p-4 shadow-xl">
                        <div className="flex flex-col gap-1 text-sm">
                          <Link
                            className="rounded-lg px-3 py-2 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
                            href="/dashboard/profile"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              setIsMenuOpen(false);
                            }}
                          >
                            <span className="flex items-center gap-3">
                              <User className="h-4 w-4" />
                              Profile
                            </span>
                          </Link>
                          <Link
                            className="rounded-lg px-3 py-2 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
                            href="/dashboard/collection"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              setIsMenuOpen(false);
                            }}
                          >
                            <span className="flex items-center gap-3">
                              <Folder className="h-4 w-4" />
                              My Collections
                            </span>
                          </Link>
                          <button
                            className="cursor-pointer rounded-lg px-3 py-2 text-left text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
                            onClick={logOut}
                          >
                            <span className="flex items-center gap-3">
                              <LogOut className="h-4 w-4" />
                              Log out
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <SearchOverlay />
    </nav>
  );
};

export default Navbar;
