'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, getProviders } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const providerStyles: Record<string, { name: string; color: string }> = {
  google:    { name: 'Google',      color: 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900' },
  facebook:  { name: 'Facebook',    color: 'border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950' },
  reddit:    { name: 'Reddit',      color: 'border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950' },
  twitter:   { name: 'X / Twitter', color: 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900' },
  linkedin:  { name: 'LinkedIn',    color: 'border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950' },
  instagram: { name: 'Instagram',   color: 'border-pink-200 text-pink-600 hover:bg-pink-50 dark:border-pink-800 dark:text-pink-400 dark:hover:bg-pink-950' },
};

const AUTH_ERRORS: Record<string, string> = {
  Callback:           'Sign-in failed during the OAuth callback. Please try again.',
  OAuthCallback:      'Could not complete sign-in with that provider. Please try again.',
  OAuthCreateAccount: 'Could not create your account. Please try again.',
  OAuthAccountNotLinked: 'This email is already linked to a different sign-in method.',
  AccessDenied:       'Access was denied. Please authorize the app on the provider screen.',
  Configuration:      'There is a server configuration error. Please contact support.',
  Verification:       'The sign-in link expired or was already used.',
  Default:            'An unexpected sign-in error occurred. Please try again.',
};

const isDebug = process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<{ id: string; name: string }[]>([]);

  // Surface NextAuth error codes passed back in the URL (e.g. ?error=Callback)
  useEffect(() => {
    const code = searchParams.get('error');
    if (code) {
      setError(AUTH_ERRORS[code] ?? AUTH_ERRORS.Default);
      // Clean the URL so a refresh doesn't re-show the same error
      router.replace('/login');
    }
  }, [searchParams, router]);

  // Fetch which OAuth providers are actually configured on the server
  useEffect(() => {
    getProviders().then((providers) => {
      if (!providers) return;
      const social = Object.values(providers).filter((p) => p.id !== 'credentials');
      setOauthProviders(social.map((p) => ({ id: p.id, name: p.name })));
    });
  }, []);

  const debugLogin = () => {
    sessionStorage.setItem('socialhub-debug-logged-in', 'true');
    window.dispatchEvent(new Event('debug-auth-change'));
    router.push('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Registration failed');
          setLoading(false);
          return;
        }
        // Auto-login after registration
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });
        if (result?.error) {
          setError('Account created! Please sign in.');
          setIsRegister(false);
        } else {
          router.push('/dashboard');
        }
      } else {
        if (isDebug) {
          debugLogin();
          return;
        }
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });
        if (result?.error) {
          setError('Invalid email or password');
        } else {
          router.push('/dashboard');
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/40 to-blue-50/50 px-4 dark:from-gray-950 dark:via-gray-950 dark:to-gray-950">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#667eea_0%,#764ba2_25%,#f093fb_50%,#4facfe_75%,#00f2fe_100%)] opacity-[0.08] dark:opacity-[0.05]" />
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-400/15" />
        <div className="absolute -right-32 top-1/4 h-[400px] w-[400px] rounded-full bg-blue-400/25 blur-3xl dark:bg-blue-400/15" />
        <div className="absolute -bottom-32 left-1/3 h-[450px] w-[450px] rounded-full bg-fuchsia-400/20 blur-3xl dark:bg-fuchsia-400/10" />
      </div>

      <Card className="w-full max-w-md border-violet-200/40 bg-white/75 shadow-xl shadow-violet-500/5 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/70">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            {isRegister ? 'Create your' : 'Sign in to'}{' '}
            <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
              SocialHub
            </span>{' '}
            {isRegister ? 'account' : ''}
          </CardTitle>
          <CardDescription className="text-gray-500 dark:text-gray-400">
            {isRegister
              ? 'Create an account to manage your social media'
              : 'Manage all your social media in one place'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {isRegister && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={isRegister}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-gray-700 dark:text-gray-300">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder={isRegister ? 'Min. 8 characters' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isRegister ? 8 : undefined}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-violet-600 to-blue-500 text-white hover:from-violet-700 hover:to-blue-600"
              disabled={loading}
            >
              {loading
                ? 'Please wait...'
                : isRegister
                  ? 'Create Account'
                  : 'Sign In'}
            </Button>
          </form>

          {/* Toggle between Sign In and Register */}
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              className="font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
            >
              {isRegister ? 'Sign in' : 'Create one'}
            </button>
          </p>

          {/* Social Sign-In — only shown when OAuth providers are configured */}
          {oauthProviders.length > 0 && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white/80 px-2 text-gray-500 dark:bg-gray-900/80 dark:text-gray-400">
                    or continue with
                  </span>
                </div>
              </div>
              <div className="grid gap-2">
                {oauthProviders.map((p) => {
                  const style = providerStyles[p.id];
                  return (
                    <Button
                      key={p.id}
                      variant="outline"
                      className={`w-full font-medium ${style?.color ?? ''}`}
                      onClick={() => signIn(p.id, { callbackUrl: '/dashboard' })}
                    >
                      Continue with {style?.name ?? p.name}
                    </Button>
                  );
                })}
              </div>
            </>
          )}

          {isDebug && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white/80 px-2 text-gray-500 dark:bg-gray-900/80 dark:text-gray-400">Debug Mode</span>
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
