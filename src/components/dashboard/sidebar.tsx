'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app';
import { useTheme } from '@/components/theme-provider';
import {
  LayoutDashboard,
  PenSquare,
  ListTodo,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Menu,
  Crown,
  Sun,
  Moon,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Compose', href: '/dashboard/compose', icon: PenSquare },
  { name: 'Queue', href: '/dashboard/queue', icon: ListTodo },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Accounts', href: '/dashboard/accounts', icon: Users },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

const isDebug = process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const { resolved, setTheme } = useTheme();

  const handleSignOut = () => {
    if (isDebug) {
      // Clear the debug session flag, notify providers, and redirect
      sessionStorage.removeItem('socialhub-debug-logged-in');
      window.dispatchEvent(new Event('debug-auth-change'));
      router.push('/login');
    } else {
      signOut({ callbackUrl: '/login' });
    }
  };

  return (
    <>
      <button
        onClick={toggleSidebar}
        className="fixed left-4 top-4 z-50 rounded-lg border bg-background/80 p-2 shadow-sm backdrop-blur-sm lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col glass-sidebar transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-6">
          <Link href="/dashboard" className="text-xl font-bold">
            Social<span className="text-primary">Hub</span>
          </Link>
          <button
            onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-background shadow-sm transition-colors hover:bg-accent"
            title={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-white/20 dark:hover:bg-white/10 hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-4">
          {(session?.user as any)?.plan !== 'PREMIUM' && (
            <Link
              href="/dashboard/settings?tab=billing"
              className="mb-3 flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-2 text-sm font-medium text-white"
            >
              <Crown className="h-4 w-4" />
              Upgrade to Premium
            </Link>
          )}

          <div className="flex items-center gap-3 px-2">
            <div className="flex-1 truncate">
              <p className="text-sm font-medium">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
