
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../app/generated/prisma/client'
import { AuthUtils } from '../lib/auth-utils'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log(`Start seeding ...`)

  // 1. Create Default Company
  const company = await prisma.company.upsert({
    where: { id: 'default-company' }, // Assumption: we might need to query by name or just create
    update: {},
    create: {
      name: 'My Accounting Firm',
      email: 'admin@acme.com',
      address: '123 Main St'
    },
  }).catch(() => {
    // Fallback if ID is uuid and we can't hardcode it easily without raw sql or changes
    // actually let's just create if not exists
    return prisma.company.create({
      data: {
        name: 'My Accounting Firm',
        email: 'admin@acme.com'
      }
    })
  });

  // 2. Create Admin Role
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'System Administrator'
    }
  })

  // 3. Create Admin User
  const email = 'admin@admin.com'
  const passwordHash = await AuthUtils.hashPassword('admin123')

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      fullName: 'System Admin',
      isActive: true,
      mustChangePass: false
    },
  })

  // 4. Link User to Role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: adminRole.id
      }
    },
    update: {},
    create: {
      userId: user.id,
      roleId: adminRole.id
    }
  })

  console.log(`Created user with id: ${user.id} and linked to ADMIN role`)
  console.log(`Seeding finished.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })