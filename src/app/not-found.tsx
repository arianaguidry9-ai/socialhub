import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 text-6xl font-extrabold text-primary">404</h1>
        <h2 className="mb-2 text-2xl font-bold">Page not found</h2>
        <p className="mb-6 text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/"
          className="inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
