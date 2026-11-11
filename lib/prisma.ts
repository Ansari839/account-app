import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL is not set in the environment variables.")
}

const pool = globalForPrisma.pool ?? new Pool({
  connectionString,
  max: process.env.NODE_ENV === 'development' ? 5 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  family: 4, // Force IPv4 to avoid IPv6 timeouts / ENETUNREACH
  ssl: { rejectUnauthorized: false },
})

pool.on('error', (err) => {
  console.error('[pg pool background error]:', err.message);
});

const adapter = new PrismaPg(pool)

const prisma = globalForPrisma.prisma ?? new PrismaClient({
    adapter,
    transactionOptions: {
        maxWait: 30000,   // max 30s wait for transaction slot
        timeout: 60000,   // max 60s for transaction to complete
    },
})

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
    globalForPrisma.pool = pool
}

export default prisma
// Force Turbopack Cache Invalidation
