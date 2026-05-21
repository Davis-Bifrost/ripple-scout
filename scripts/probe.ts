import { prisma } from "../src/lib/db.ts";

async function main() {
  const obs = await prisma.$queryRaw<{ t: string; crawledAt: unknown }[]>`
    SELECT typeof(crawledAt) AS t, crawledAt FROM ChannelObservation WHERE crawledAt IS NOT NULL LIMIT 3
  `;
  console.log("Sample rows:", obs);

  const obs2 = await prisma.$queryRaw<{ day: string | null; crawledAt: unknown }[]>`
    SELECT strftime('%Y-%m-%d', crawledAt) AS day, crawledAt
    FROM ChannelObservation
    WHERE crawledAt IS NOT NULL
    LIMIT 3
  `;
  console.log("strftime(raw) test:", obs2);

  const obs3 = await prisma.$queryRaw<{ day: string; count: number }[]>`
    SELECT strftime('%Y-%m-%d', datetime(crawledAt / 1000, 'unixepoch')) AS day, COUNT(*) AS count
    FROM ChannelObservation
    WHERE crawledAt IS NOT NULL
    GROUP BY day
    ORDER BY day
    LIMIT 10
  `;
  console.log("datetime(unixepoch) test:", obs3);

  const c = await prisma.channelObservation.count({ where: { crawledAt: { not: null } } });
  console.log("Obs with non-null crawledAt (Prisma view):", c);

  await prisma.$disconnect();
}
main();
