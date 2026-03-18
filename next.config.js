/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_DEBUG_AUTH: process.env.DEBUG_AUTH || '',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.redd.it' },
      { protocol: 'https', hostname: 'pbs.twimg.com' },
      { protocol: 'https', hostname: '*.cdninstagram.com' },
      { protocol: 'https', hostname: '*.licdn.com' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['pino', 'pino-pretty'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://api.stripe.com https://api.anthropic.com https://apis.google.com https://*.googleapis.com https://*.firebaseio.com wss:",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              "base-uri 'self'",
              "form-action 'self' https://twitter.com https://x.com https://accounts.google.com https://www.facebook.com https://www.reddit.com https://www.linkedin.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
