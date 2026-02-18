/**
 * Multi-Company Data Migration Script
 * 
 * This script assigns all existing data to the 'default-company' company.
 * Run this AFTER `prisma migrate dev` to populate companyId on existing rows.
 * 
 * Usage: npx tsx scripts/migrate-multicompany.ts
 */

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const DEFAULT_COMPANY_ID = 'default-company';

// Tables that need companyId populated
const TABLES_WITH_COMPANY_ID = [
    'Product',
    'ProductVariant',
    'Category',
    'Supplier',
    'Customer',
    'Warehouse',
    'Unit',
    'UnitConversion',
    'Currency',
    'TaxCode',
    'StockLedger',
    'SalesQuotation',
    'SalesQuotationItem',
    'SalesOrder',
    'SalesOrderItem',
    'DeliveryOrder',
    'DeliveryOrderItem',
    'SalesInvoice',
    'SalesInvoiceItem',
    'SalesReturn',
    'SalesReturnItem',
    'PurchaseRequest',
    'PurchaseRequestItem',
    'PurchaseOrder',
    'PurchaseOrderItem',
    'GRN',
    'GRNItem',
    'PurchaseInvoice',
    'PurchaseInvoiceItem',
    'PurchaseReturn',
    'PurchaseReturnItem',
    'JournalEntry',
    'JournalLine',
    'FinancialYear',
    'VoucherSequence',
    'Role',
];

async function main() {
    console.log('🚀 Multi-Company Data Migration Starting...\n');

    // 1. Ensure default company exists
    const company = await prisma.company.findUnique({ where: { id: DEFAULT_COMPANY_ID } });
    if (!company) {
        console.log('⚠️  Default company not found. Creating...');
        await prisma.company.create({
            data: {
                id: DEFAULT_COMPANY_ID,
                name: 'Default Company',
                email: 'admin@default.com',
            }
        });
        console.log('✅ Default company created.\n');
    } else {
        console.log(`✅ Default company exists: "${company.name}"\n`);
    }

    // 2. Update each table to set companyId = default-company where companyId is NULL
    for (const table of TABLES_WITH_COMPANY_ID) {
        try {
            const result = await prisma.$executeRawUnsafe(
                `UPDATE "${table}" SET "companyId" = $1 WHERE "companyId" IS NULL`,
                DEFAULT_COMPANY_ID
            );
            if (result > 0) {
                console.log(`  ✅ ${table}: updated ${result} rows`);
            } else {
                console.log(`  ⏭️  ${table}: no rows to update`);
            }
        } catch (error: any) {
            // Table might not exist yet (if migration hasn't run) or column doesn't exist
            console.log(`  ⚠️  ${table}: ${error.message?.split('\n')[0]}`);
        }
    }

    // 3. Migrate GlobalSetting → CompanySetting (if old table still exists)
    try {
        const oldSettings = await prisma.$queryRawUnsafe(
            `SELECT * FROM "GlobalSetting"`
        ) as any[];

        if (oldSettings.length > 0) {
            console.log(`\n📋 Migrating ${oldSettings.length} GlobalSettings to CompanySetting...`);
            for (const s of oldSettings) {
                try {
                    await prisma.companySetting.upsert({
                        where: { companyId_key: { companyId: DEFAULT_COMPANY_ID, key: s.key } },
                        update: { value: s.value, type: s.type, group: s.group },
                        create: {
                            companyId: DEFAULT_COMPANY_ID,
                            key: s.key,
                            value: s.value,
                            type: s.type || 'STRING',
                            group: s.group,
                        }
                    });
                } catch (e: any) {
                    console.log(`  ⚠️  Setting "${s.key}": ${e.message?.split('\n')[0]}`);
                }
            }
            console.log('  ✅ Settings migrated.');
        }
    } catch {
        console.log('\n⏭️  No old GlobalSetting table found (already migrated).');
    }

    // 4. Create UserCompany entries for existing users
    console.log('\n👥 Creating UserCompany entries for existing users...');
    const users = await prisma.user.findMany();
    for (const user of users) {
        const targetCompanyId = user.companyId || DEFAULT_COMPANY_ID;

        try {
            await prisma.userCompany.upsert({
                where: {
                    userId_companyId: { userId: user.id, companyId: targetCompanyId }
                },
                update: {},
                create: {
                    userId: user.id,
                    companyId: targetCompanyId,
                    role: user.isSuperAdmin ? 'OWNER' : 'ADMIN',
                    isDefault: true,
                }
            });
            console.log(`  ✅ ${user.email} → ${targetCompanyId} (${user.isSuperAdmin ? 'OWNER' : 'ADMIN'})`);
        } catch (e: any) {
            console.log(`  ⚠️  ${user.email}: ${e.message?.split('\n')[0]}`);
        }
    }

    // 5. Mark the first admin user as Super Admin if none exists
    const superAdmins = await prisma.user.count({ where: { isSuperAdmin: true } });
    if (superAdmins === 0) {
        const firstAdmin = await prisma.user.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' }
        });
        if (firstAdmin) {
            await prisma.user.update({
                where: { id: firstAdmin.id },
                data: { isSuperAdmin: true }
            });
            console.log(`\n👑 Promoted "${firstAdmin.email}" to Super Admin`);
        }
    }

    console.log('\n🎉 Multi-Company Data Migration Complete!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
