'use client';

import { useState, useEffect } from 'react';
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
  Bell,
  Megaphone,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Compose', href: '/dashboard/compose', icon: PenSquare },
  { name: 'Queue', href: '/dashboard/queue', icon: ListTodo },
  { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Promotions', href: '/dashboard/promotions', icon: Megaphone },
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
  // Prevent hydration mismatch: useSession and useTheme return different values
  // on the server vs the client. Only render user-specific content after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1024 && sidebarOpen) toggleSidebar();
  };

  const handleSignOut = () => {
    if (isDebug) {
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
        className="fixed left-4 top-4 z-50 glass rounded-xl p-2.5 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col glass-sidebar transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-[72px] items-center border-b border-border/40 px-7">
          <Link href="/dashboard" className="text-2xl font-bold tracking-tight text-foreground">
            Social<span className="text-primary">Hub</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-5">
          {navigation.map((item) => {
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebarOnMobile}
                className={cn(
                  'flex items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] font-medium transition-all',
                  isActive
                    ? 'glass text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-border/40 p-5">
          {(session?.user as any)?.plan !== 'PREMIUM' && (
            <Link
              href="/dashboard/settings?tab=billing"
              className="mb-4 flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/20"
            >
              <Crown className="h-5 w-5" />
              Upgrade to Premium
            </Link>
          )}

          {/* User + Sign Out */}
          <div className="mb-4 flex items-center gap-3 rounded-xl px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              {mounted ? (session?.user?.name?.charAt(0) ?? '?') : '?'}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium">{mounted ? (session?.user?.name ?? 'User') : 'User'}</p>
              <p className="text-xs text-muted-foreground">{mounted ? session?.user?.email : ''}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Theme toggle — bottom left */}
          <button
            onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-accent/60 hover:text-foreground"
            title={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {mounted && resolved === 'dark' ? (
              <>
                <Sun className="h-5 w-5 text-amber-400" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-5 w-5 text-indigo-400" />
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
