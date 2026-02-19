import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const email = 'admin@antigravity.erp';
    console.log(`Checking user: ${email}...`);

    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        console.error('❌ User not found!');
        return;
    }

    console.log('✅ User found:', user.id, user.fullName);
    console.log('User active:', user.isActive);
    console.log('User isSuperAdmin:', user.isSuperAdmin);

    const isMatch = await bcrypt.compare('Admin@123', user.passwordHash);
    console.log('Password valid:', isMatch);

    // Check companies
    const userCompanies = await prisma.userCompany.findMany({
        where: { userId: user.id }
    });
    console.log('User companies:', userCompanies.length);
}

main()
    .catch(e => {
        fs.writeFileSync('login_error.txt', JSON.stringify(e, null, 2) + '\n' + e.toString());
        console.error(e);
    })
    .finally(() => prisma.$disconnect());
