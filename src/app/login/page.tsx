'use client';

import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const providers = [
  { id: 'reddit',    name: 'Reddit',      color: 'border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950' },
  { id: 'twitter',   name: 'X / Twitter',  color: 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900' },
  { id: 'linkedin',  name: 'LinkedIn',     color: 'border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950' },
  { id: 'instagram', name: 'Instagram',    color: 'border-pink-200 text-pink-600 hover:bg-pink-50 dark:border-pink-800 dark:text-pink-400 dark:hover:bg-pink-950' },
  { id: 'tiktok',    name: 'TikTok',       color: 'border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-950' },
];

const isDebug = process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true';

export default function LoginPage() {
  const router = useRouter();

  const debugLogin = () => {
    sessionStorage.setItem('socialhub-debug-logged-in', 'true');
    window.dispatchEvent(new Event('debug-auth-change'));
    router.push('/dashboard');
  };

  const handleSignIn = (providerId: string) => {
    if (isDebug) {
      debugLogin();
    } else {
      signIn(providerId, { callbackUrl: '/dashboard' });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Background — matches the landing page gradient feel */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#667eea_0%,#764ba2_25%,#f093fb_50%,#4facfe_75%,#00f2fe_100%)] opacity-[0.07]" />
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-violet-400/20 blur-3xl" />
        <div className="absolute -right-32 top-1/4 h-[400px] w-[400px] rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-[450px] w-[450px] rounded-full bg-fuchsia-400/15 blur-3xl" />
      </div>

      <Card className="w-full max-w-md border-white/60 bg-white/70 shadow-xl backdrop-blur-lg dark:border-gray-800 dark:bg-gray-900/70">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Sign in to{' '}
            <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
              SocialHub
            </span>
          </CardTitle>
          <CardDescription>
            Connect your social media accounts to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {providers.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              className={`w-full font-medium ${p.color}`}
              onClick={() => handleSignIn(p.id)}
            >
              Continue with {p.name}
            </Button>
          ))}
          {isDebug && (
            <>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white/80 px-2 text-muted-foreground dark:bg-gray-900/80">Debug Mode</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full border-dashed border-yellow-400 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-600 dark:text-yellow-400 dark:hover:bg-yellow-950"
                onClick={debugLogin}
              >
                Enter as Debug User
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
