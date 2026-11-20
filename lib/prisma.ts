import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool, Client } from 'pg'
import dns from 'node:dns'

// Force IPv4 lookup first in Node 24 to prevent Neon IPv6 ETIMEDOUT / ENETUNREACH
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first')
}

class IPv4Client extends Client {
  constructor(config?: any) {
    if (typeof config === 'string') {
      super({ connectionString: config, family: 4, ssl: { rejectUnauthorized: false } })
    } else {
      super({ ...(config || {}), family: 4, ssl: { rejectUnauthorized: false } })
    }
  }
}

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
  Client: IPv4Client,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: { rejectUnauthorized: false },
})

pool.on('error', (err) => {
  console.error('[pg pool background error]:', err.message);
});

const adapter = new PrismaPg(pool)

// Auto-detect stale PrismaClient in development global cache (e.g. after schema changes)
if (globalForPrisma.prisma && !(globalForPrisma.prisma as any).productionAccrual) {
  console.log('[Prisma]: Stale PrismaClient instance detected in global cache (missing latest models). Re-instantiating...');
  try {
    (globalForPrisma.prisma as any).$disconnect?.();
  } catch {}
  globalForPrisma.prisma = undefined;
}

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
