import dynamic from 'next/dynamic';

// Load the login form purely on the client � no SSR.
// This eliminates hydration mismatches caused by useSearchParams and
// session-dependent state that differ between server and client renders.
const LoginClient = dynamic(() => import('./login-client'), { ssr: false });

export default function LoginPage() {
  return <LoginClient />;
}
