'use client';

import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Check, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

const premiumFeatures = [
  'Unlimited social accounts',
  'Unlimited post scheduling',
  'Full analytics history + CSV export',
  'Unlimited AI features',
  'Reddit rule compliance checker',
  'Priority publishing queue',
  'Team collaboration (up to 3 seats)',
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const plan = (session?.user as any)?.plan || 'FREE';
  const { theme, setTheme } = useTheme();

  const handleUpgrade = async () => {
    const res = await fetch('/api/stripe/checkout', { method: 'POST' });
    const { url } = await res.json();
    if (url) {
      window.location.href = url;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and subscription</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose your preferred theme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'light' as const, label: 'Light', icon: Sun },
              { value: 'dark' as const, label: 'Dark', icon: Moon },
              { value: 'system' as const, label: 'System', icon: Monitor },
            ]).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                  theme === value
                    ? 'glass border-primary/50 shadow-lg shadow-primary/10'
                    : 'border-transparent bg-white/20 hover:bg-white/40 dark:bg-white/5 dark:hover:bg-white/10'
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current Plan
            <Badge variant={plan === 'PREMIUM' ? 'default' : 'secondary'}>
              {plan}
            </Badge>
          </CardTitle>
          <CardDescription>
            {plan === 'PREMIUM'
              ? 'You have full access to all features.'
              : 'Upgrade to Premium for unlimited access.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plan !== 'PREMIUM' && (
            <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-purple-50 p-6 dark:from-blue-950/30 dark:to-purple-950/30">
              <div className="mb-4 flex items-center gap-2">
                <Crown className="h-6 w-6 text-amber-500" />
                <h3 className="text-xl font-bold">Premium Plan</h3>
              </div>
              <p className="mb-1 text-3xl font-bold">
                $12<span className="text-base font-normal text-muted-foreground">/month</span>
              </p>
              <p className="mb-4 text-sm text-muted-foreground">or $99/year (save 31%)</p>
              <ul className="mb-6 space-y-2">
                {premiumFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button onClick={handleUpgrade} className="w-full">
                Upgrade to Premium
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="font-medium">{session?.user?.name || '—'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{session?.user?.email || '—'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
