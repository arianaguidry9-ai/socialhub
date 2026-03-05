'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/toaster';

const DEBUG_SESSION = process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true'
  ? {
      user: {
        id: 'debug-user-001',
        name: 'Debug User',
        email: 'debug@socialhub.dev',
        plan: 'premium',
        image: null,
      },
      expires: new Date(Date.now() + 86400_000).toISOString(),
    }
  : undefined;

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1 },
        },
      })
  );

  return (
    <SessionProvider session={DEBUG_SESSION as any}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </SessionProvider>
  );
}
