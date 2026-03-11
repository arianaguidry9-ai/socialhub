import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'SocialHub — Social Media Management Platform',
    template: '%s | SocialHub',
  },
  description:
    'Schedule posts, analyze performance, and manage all your social media accounts from one dashboard.',
  metadataBase: new URL(APP_URL),
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SocialHub',
  },
  openGraph: {
    type: 'website',
    siteName: 'SocialHub',
    title: 'SocialHub — Social Media Management Platform',
    description:
      'Schedule posts, analyze performance, and manage all your social media accounts from one dashboard.',
    url: APP_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SocialHub — Social Media Management Platform',
    description:
      'Schedule posts, analyze performance, and manage all your social media accounts from one dashboard.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('socialhub-theme');if(t==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
