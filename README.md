# SocialHub

Full-featured social media management platform with scheduling, analytics, AI-powered content tools, and Reddit-specific intelligence.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5.7 |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL + Prisma ORM |
| Cache / Queue | Redis + BullMQ |
| Auth | NextAuth.js v4 (OAuth2) |
| AI | Anthropic SDK (Claude) |
| Payments | Stripe (subscriptions) |
| Email | Resend |
| Charts | Recharts |
| State | Zustand + TanStack React Query |
| Validation | Zod |
| Logging | Pino |
| Testing | Jest + React Testing Library |

## Features

- **Multi-platform publishing** — Reddit, Twitter/X, LinkedIn, Instagram
- **AI-powered content** — Caption generation, hashtag suggestions, content repurposing
- **Reddit intelligence** — Subreddit rule analysis, karma/age compliance checks
- **Smart scheduling** — BullMQ-powered queue with priority for Premium users
- **Analytics dashboard** — Engagement metrics, posting heatmaps, platform comparisons, CSV export
- **Freemium model** — Stripe-powered subscriptions with feature gating
- **Secure token storage** — AES-256-GCM encryption for OAuth tokens at rest

## Project Structure

```
socialhub/
├── prisma/
│   ├── schema.prisma        # Database schema (14 models, 6 enums)
│   └── seed.ts              # Demo seed data
├── src/
│   ├── app/
│   │   ├── api/             # API routes (auth, posts, analytics, AI, Stripe)
│   │   ├── dashboard/       # Dashboard pages (compose, queue, analytics, accounts, settings)
│   │   ├── login/           # OAuth sign-in page
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Landing page
│   ├── components/          # UI components (shadcn/ui + custom)
│   ├── hooks/               # Custom React hooks
│   ├── lib/
│   │   ├── ai/              # Anthropic client, Reddit analyzer, content AI
│   │   ├── analytics/       # Aggregation queries
│   │   ├── auth/            # NextAuth config + session helpers
│   │   ├── connectors/      # Platform connectors (Reddit, Twitter, LinkedIn, Instagram)
│   │   ├── queue/           # BullMQ queues + workers
│   │   ├── stripe/          # Stripe client, feature gates
│   │   ├── db.ts            # Prisma client singleton
│   │   ├── redis.ts         # Redis client singleton
│   │   ├── encryption.ts    # AES-256-GCM encrypt/decrypt
│   │   ├── logger.ts        # Pino logger
│   │   ├── utils.ts         # Utility functions
│   │   └── validations.ts   # Zod schemas
│   ├── stores/              # Zustand stores
│   └── types/               # TypeScript type definitions
├── tests/                   # Jest test suites
├── Dockerfile               # Multi-stage production Docker build
├── vercel.json              # Vercel deployment config
├── railway.toml             # Railway deployment config
└── .env.example             # Environment variable template
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Setup

1. **Clone and install dependencies**

```bash
git clone <repo-url> socialhub
cd socialhub
npm install
```

2. **Configure environment variables**

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`. See the template for required OAuth app credentials, API keys, and database URLs.

3. **Set up the database**

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database
npm run db:seed       # Seed demo data (optional)
```

4. **Start the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

5. **Start the queue workers** (separate terminal)

```bash
npm run queue:worker
```

## Available Scripts

| Script | Description |
|--------|------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Create and apply migration |
| `npm run db:seed` | Seed database with demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run queue:worker` | Start BullMQ workers (publish, metrics, tokens, email) |
| `npm run queue:metrics` | Run one-off metrics aggregation |

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth.js authentication |
| `/api/accounts/link` | GET | List connected social accounts |
| `/api/accounts/link` | POST | Connect a new social account |
| `/api/posts` | GET | List posts (paginated) |
| `/api/posts` | POST | Create and optionally schedule a post |
| `/api/reddit/analyze` | POST | Analyze subreddit rule compliance (Premium) |
| `/api/ai/caption` | POST | Generate AI caption |
| `/api/ai/hashtags` | POST | Suggest hashtags |
| `/api/analytics` | GET | Fetch analytics data |
| `/api/analytics/export` | GET | Export analytics as CSV (Premium) |
| `/api/stripe/checkout` | POST | Create Stripe checkout session |
| `/api/stripe/webhook` | POST | Handle Stripe webhook events |

## Freemium Tiers

| Feature | Free | Premium |
|---------|------|---------|
| Connected accounts | 3 | Unlimited |
| Posts per month | 30 | Unlimited |
| AI captions per month | 10 | Unlimited |
| Analytics window | 7 days | Unlimited |
| Reddit rule analysis | — | ✓ |
| Priority queue | — | ✓ |
| CSV export | — | ✓ |
| Team collaboration | — | ✓ |

## Deployment

### Vercel

The project includes a `vercel.json` with recommended configuration. Deploy via the Vercel CLI or GitHub integration. Note: BullMQ workers must run separately (e.g., on Railway or a VPS).

### Railway

A `railway.toml` is included for Railway deployments. Configure `DATABASE_URL` and `REDIS_URL` via Railway's service provisioning.

### Docker

```bash
docker build -t socialhub .
docker run -p 3000:3000 --env-file .env.local socialhub
```

## Testing

```bash
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

Test files are in the `tests/` directory covering encryption, utilities, validations, feature gates, queue scheduling, and platform connectors.

## License

Private — All rights reserved.
