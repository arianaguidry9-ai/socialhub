'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';

const isDebug = process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true';

function makeDebugSession() {
  return {
    user: {
      id: 'debug-user-001',
      name: 'Debug User',
      email: 'debug@socialhub.dev',
      plan: 'premium',
      image: null,
    },
    expires: new Date(Date.now() + 86400_000).toISOString(),
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1 },
        },
      })
  );

  // In debug mode, only inject session if user has "logged in"
  const [debugSession, setDebugSession] = useState<any>(undefined);

  useEffect(() => {
    if (!isDebug) return;
    const loggedIn = sessionStorage.getItem('socialhub-debug-logged-in');
    if (loggedIn === 'true') {
      setDebugSession(makeDebugSession());
    }

    // Listen for login/logout
    const handler = () => {
      const val = sessionStorage.getItem('socialhub-debug-logged-in');
      setDebugSession(val === 'true' ? makeDebugSession() : undefined);
    };
    window.addEventListener('storage', handler);
    // Custom event for same-tab updates
    window.addEventListener('debug-auth-change', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('debug-auth-change', handler);
    };
  }, []);

  const session = isDebug ? debugSession : undefined;

  return (
    <ThemeProvider>
      <SessionProvider session={session}>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster />
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
