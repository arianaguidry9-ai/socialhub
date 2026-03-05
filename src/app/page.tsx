import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-gray-900">
          Social<span className="text-primary">Hub</span>
        </h1>
        <p className="mb-8 text-xl text-muted-foreground">
          Schedule posts, analyze performance, and manage all your social media
          accounts from one powerful dashboard.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-input bg-background px-6 py-3 text-sm font-medium hover:bg-accent"
          >
            Sign In
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { title: 'Multi-Platform', desc: 'Reddit, X, Instagram, LinkedIn and more' },
            { title: 'AI-Powered', desc: 'Smart captions, compliance checking, optimal timing' },
            { title: 'Deep Analytics', desc: 'Track engagement, growth, and content performance' },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6 text-left shadow-sm">
              <h3 className="mb-2 font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
