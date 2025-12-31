import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('--- Verifying Users ---');
    const users = await prisma.user.findMany({
        select: { id: true, email: true, companyId: true }
    });
    console.table(users);

    console.log('\n--- Verifying Companies ---');
    const companies = await prisma.company.findMany();
    console.table(companies);

    console.log('\n--- Verifying Accounts (First 10) ---');
    const accounts = await prisma.account.findMany({
        take: 10,
        select: { id: true, code: true, name: true, companyId: true, parentId: true }
    });
    console.table(accounts);

    const rootAccounts = await prisma.account.count({ where: { parentId: null } });
    const totalAccounts = await prisma.account.count();
    console.log(`\nTotal Accounts: ${totalAccounts}, Root Accounts (parentId is null): ${rootAccounts}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
