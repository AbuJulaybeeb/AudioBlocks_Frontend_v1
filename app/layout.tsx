import { Suspense } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import { Toaster } from 'sonner';
import './globals.css';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import AccessibilityAnnouncer from '@/components/AccessibilityAnnouncer';
import EnvCheck from '@/components/EnvCheck';
import SWRegister from '@/components/SWRegister';
import { ThemeScript } from '@/components/ThemeScript';
import RouteProgress from '@/components/ui/RouteProgress';
import PrivyAuthProvider from '@/context/PrivyAuthProvider';
import Provider from '@/context/provider';
import type { Metadata } from 'next';
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'AudioBlocks — Stream, Earn & Collect Music NFTs',
  description:
    'AudioBlocks is a Web3 music platform where listeners stream ad-free music and earn rewards while artists upload tracks, sell NFTs, and get paid fairly.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <PrivyAuthProvider>
          <Provider>
            <Suspense fallback={null}>
              <RouteProgress />
            </Suspense>
            <SWRegister />
            <EnvCheck />
            <AccessibilityAnnouncer />
            <a
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-9999 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded focus:font-semibold"
              href="#main-content"
            >
              Skip to main content
            </a>
            <Toaster closeButton position="bottom-right" />
            {children}
            {/* Analytics script loaded after user interaction to reduce main thread blocking */}
            <Script
              id="analytics-script"
              src="https://www.google-analytics.com/analytics.js"
              strategy="lazyOnload"
            />
          </Provider>
        </PrivyAuthProvider>
      </body>
    </html>
  );
}
