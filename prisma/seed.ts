import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create a demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@socialhub.app' },
    update: {},
    create: {
      email: 'demo@socialhub.app',
      name: 'Demo User',
      plan: 'FREE',
      timezone: 'America/New_York',
    },
  });

  console.log(`Created user: ${user.email}`);

  // Seed popular subreddit rule caches for dev
  const subs = ['technology', 'programming', 'webdev', 'javascript'];
  for (const sub of subs) {
    await prisma.subredditRulesCache.upsert({
      where: { subreddit: sub },
      update: {},
      create: {
        subreddit: sub,
        rulesJson: { rules: [{ short_name: 'No spam', description: 'No spamming allowed' }] },
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
