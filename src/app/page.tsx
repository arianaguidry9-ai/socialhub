import Link from 'next/link';
import { BarChart3, Globe, Sparkles, Zap, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/40 to-blue-50/50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-950">
      {/* Animated gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#667eea_0%,#764ba2_25%,#f093fb_50%,#4facfe_75%,#00f2fe_100%)] opacity-[0.08] dark:opacity-[0.05]" />
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-400/15" />
        <div className="absolute -right-32 top-1/4 h-[400px] w-[400px] rounded-full bg-blue-400/25 blur-3xl dark:bg-blue-400/15" />
        <div className="absolute -bottom-32 left-1/3 h-[450px] w-[450px] rounded-full bg-fuchsia-400/20 blur-3xl dark:bg-fuchsia-400/10" />
        <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-400/10" />
      </div>

      {/* Nav */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
          Social<span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">Hub</span>
        </span>
        <Link
          href="/login"
          className="rounded-full border border-violet-200/60 bg-white/70 px-5 py-2 text-sm font-medium text-gray-700 shadow-sm backdrop-blur transition-colors hover:bg-white hover:border-violet-300 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <main className="mx-auto flex max-w-5xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200/60 bg-violet-50/80 px-4 py-1.5 text-sm font-medium text-violet-700 backdrop-blur dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
          <Sparkles className="h-3.5 w-3.5" />
          AI-powered social media management
        </div>

        <h1 className="mb-5 text-5xl font-extrabold leading-[1.1] tracking-tight text-gray-900 dark:text-gray-50 sm:text-6xl lg:text-7xl">
          All your socials,{' '}
          <span className="bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
            one dashboard
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-600 dark:text-gray-400 sm:text-xl">
          Schedule posts, track analytics, and manage Reddit, X, Instagram, TikTok &amp; LinkedIn
          — all from a single, beautiful interface.
        </p>

        <Link
          href="/login"
          className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-blue-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 hover:scale-[1.02]"
        >
          Get Started Free
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>

        {/* Feature cards */}
        <div className="mt-20 grid w-full max-w-3xl gap-5 sm:grid-cols-3">
          {[
            {
              icon: Globe,
              title: 'Multi-Platform',
              desc: 'Reddit, X, Instagram, TikTok, LinkedIn — post everywhere at once.',
              gradient: 'from-violet-500 to-purple-600',
              borderColor: 'border-violet-200/50 dark:border-violet-800/50',
            },
            {
              icon: Sparkles,
              title: 'AI-Powered',
              desc: 'Smart captions, rule compliance, and optimal post timing.',
              gradient: 'from-blue-500 to-cyan-500',
              borderColor: 'border-blue-200/50 dark:border-blue-800/50',
            },
            {
              icon: BarChart3,
              title: 'Deep Analytics',
              desc: 'Track engagement, growth, and content performance in real time.',
              gradient: 'from-fuchsia-500 to-pink-500',
              borderColor: 'border-pink-200/50 dark:border-pink-800/50',
            },
          ].map((f) => (
            <div
              key={f.title}
              className={`group rounded-2xl ${f.borderColor} border bg-white/60 p-6 text-left shadow-sm backdrop-blur-lg transition-all hover:shadow-md hover:-translate-y-0.5 dark:bg-gray-900/50`}
            >
              <div className={`mb-3 inline-flex rounded-xl bg-gradient-to-br ${f.gradient} p-2.5 text-white shadow-sm`}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1 font-semibold text-gray-900 dark:text-gray-100">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Social proof strip */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-500">
          <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-amber-500" /> Free to start</span>
          <span className="hidden text-violet-300 dark:text-gray-600 sm:inline">·</span>
          <span>No credit card required</span>
          <span className="hidden text-violet-300 dark:text-gray-600 sm:inline">·</span>
          <span>Works with 5+ platforms</span>
        </div>
      </main>
    </div>
  );
}
