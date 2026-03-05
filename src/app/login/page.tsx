'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const providers = [
  { id: 'reddit', name: 'Reddit', color: 'bg-orange-500 hover:bg-orange-600' },
  { id: 'twitter', name: 'X / Twitter', color: 'bg-black hover:bg-gray-800' },
  { id: 'linkedin', name: 'LinkedIn', color: 'bg-blue-600 hover:bg-blue-700' },
  { id: 'instagram', name: 'Instagram', color: 'bg-pink-500 hover:bg-pink-600' },
];

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            Sign in to Social<span className="text-primary">Hub</span>
          </CardTitle>
          <CardDescription>
            Connect your social media accounts to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {providers.map((p) => (
            <Button
              key={p.id}
              className={`w-full text-white ${p.color}`}
              onClick={() => signIn(p.id, { callbackUrl: '/dashboard' })}
            >
              Continue with {p.name}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
