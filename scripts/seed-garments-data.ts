import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
    console.log("🧹 STARTING SYSTEM RESET & FOUNDATION SEED...");
    const CID = 'garments-company-1';

    try {
        // --- 1. AGGRESSIVE CLEANUP (Reverse Dependency Order) ---
        console.log("🔥 Wiping all transactional and master data...");

        // Transaction Entries
        await prisma.stockLedger.deleteMany({});
        await prisma.journalLine.deleteMany({});
        await prisma.journalEntry.deleteMany({});

        // Purchase Module
        await prisma.purchaseInvoiceItem.deleteMany({});
        await prisma.purchaseInvoice.deleteMany({});
        await prisma.gRNItem.deleteMany({});
        await prisma.gRN.deleteMany({});
        await prisma.purchaseOrderItem.deleteMany({});
        await prisma.purchaseOrder.deleteMany({});

        // Sales Module
        await prisma.salesReturnItem.deleteMany({});
        await prisma.salesReturn.deleteMany({});
        await prisma.salesInvoiceItem.deleteMany({});
        await prisma.salesInvoice.deleteMany({});
        await prisma.deliveryOrderItem.deleteMany({});
        await prisma.deliveryOrder.deleteMany({});
        await prisma.salesOrderItem.deleteMany({});
        await prisma.salesOrder.deleteMany({});
        await prisma.salesQuotationItem.deleteMany({});
        await prisma.salesQuotation.deleteMany({});

        // Masters (Depend on Company/Accounts often, but we wipe Accounts next)
        await prisma.product.deleteMany({});
        await prisma.supplier.deleteMany({});
        await prisma.customer.deleteMany({});
        await prisma.category.deleteMany({});
        // await prisma.warehouse.deleteMany({}); // Optional: Keep warehouses or wipe? Wiping for clean slate.
        // await prisma.unit.deleteMany({});      // Optional: Units are global typically.

        // Accounts (Wipe company specific accounts)
        await prisma.account.deleteMany({ where: { companyId: CID } });

        console.log("✨ Data wiped successfully.");

        // --- 2. FOUNDATION SETUP ---
        console.log("🏗️ Building Foundation (Company, User, COA)...");

        // A. Company
        await prisma.company.upsert({
            where: { id: CID },
            update: { name: 'Stitch & Style Garments Ltd' },
            create: { id: CID, name: 'Stitch & Style Garments Ltd', address: 'Garment Zone, Karachi', email: 'factory@stitchstyle.com' }
        });

        // B. Financial Year
        let fy = await prisma.financialYear.findFirst({ where: { name: "FY 2025-26" } });
        if (!fy) {
            fy = await prisma.financialYear.create({
                data: { id: 'fy-2025-garments', name: "FY 2025-26", startDate: new Date("2025-04-01"), endDate: new Date("2026-03-31"), isOpen: true }
            });
        }

        // C. User
        const passwordHash = await bcrypt.hash('Stitch@123', 10);
        await prisma.user.upsert({
            where: { email: 'garments@stitchstyle.com' },
            update: { companyId: CID, mustChangePass: false },
            create: { id: 'garments-user-1', email: 'garments@stitchstyle.com', passwordHash, fullName: 'Garments Admin', companyId: CID, isActive: true, mustChangePass: false }
        });

        // D. Professional Chart of Accounts
        const coa = [
            // Level 0: Roots
            { code: '1000', name: 'ASSETS', type: 'ASSET', isPosting: false },
            { code: '2000', name: 'LIABILITIES', type: 'LIABILITY', isPosting: false },
            { code: '3000', name: 'EQUITY', type: 'EQUITY', isPosting: false },
            { code: '4000', name: 'INCOME', type: 'INCOME', isPosting: false },
            { code: '5000', name: 'EXPENSES', type: 'EXPENSE', isPosting: false },

            // Assets
            { code: '1100', name: 'Cash in Hand', type: 'ASSET', parentCode: '1000' },
            { code: '1110', name: 'HBL Factory Account', type: 'ASSET', parentCode: '1000' },
            { code: '1210', name: 'Raw Material Inventory', type: 'ASSET', parentCode: '1000' },
            { code: '1220', name: 'Finished Goods Inventory', type: 'ASSET', parentCode: '1000' },
            { code: '1300', name: 'Accounts Receivable', type: 'ASSET', parentCode: '1000' },

            // Liabilities
            { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', parentCode: '2000' },
            { code: '2200', name: 'Accrued Purchase Liability (GRN Suspense)', type: 'LIABILITY', parentCode: '2000' },

            // Equity
            { code: '3100', name: 'Capital Invested', type: 'EQUITY', parentCode: '3000' },
            { code: '3200', name: 'Owner Drawings', type: 'EQUITY', parentCode: '3000' },

            // Income
            { code: '4100', name: 'Product Sales', type: 'INCOME', parentCode: '4000' },

            // Expenses
            { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', parentCode: '5000' },
            { code: '5200', name: 'Factory Utility Bills', type: 'EXPENSE', parentCode: '5000' },
            { code: '5300', name: 'Staff Wages', type: 'EXPENSE', parentCode: '5000' },
        ];

        const accMap: Record<string, string> = {};
        for (const ac of coa) {
            const pId = ac.parentCode ? accMap[ac.parentCode] : null;
            const account = await prisma.account.create({
                data: { code: ac.code, name: ac.name, type: ac.type as any, isPosting: ac.isPosting !== false, parentId: pId, companyId: CID, level: pId ? 1 : 0 }
            });
            accMap[ac.code] = account.id;
        }

        console.log("✅ RESET COMPLETE. System ready for manual entry.");
    } catch (e) {
        console.error("❌ Seeding Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

seed();
