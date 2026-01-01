import 'dotenv/config';
import { PrismaClient } from '@/app/generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function verify(companyId: string) {
    console.log(`\n🔍 Verifying Data Presence for '${companyId}'...`);

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    console.log(`🏢 Company: ${company?.name || 'NOT FOUND'}`);

    const accountsCount = await prisma.account.count({ where: { companyId } });
    console.log(`🗂️ Accounts: ${accountsCount}`);

    const productsCount = await prisma.product.count({ where: { code: { startsWith: 'GPROD-' } } });
    console.log(`📦 Garment Products: ${productsCount}`);

    const scount = await prisma.supplier.count({ where: { code: { startsWith: 'GSUPP-' } } });
    console.log(`🤝 Garment Suppliers: ${scount}`);

    const poCount = await prisma.purchaseOrder.count({ where: { poNo: { startsWith: 'GARMENT-PO-' } } });
    const grnCount = await prisma.gRN.count({ where: { grnNo: { startsWith: 'GARMENT-GRN-' } } });
    const piCount = await prisma.purchaseInvoice.count({ where: { invoiceNo: { startsWith: 'GARMENT-PI-' } } });

    console.log(`🧾 Document Counts: POs: ${poCount}, GRNs: ${grnCount}, PIs: ${piCount}`);

    const journalsCount = await prisma.journalEntry.count({
        where: { OR: [{ lines: { some: { account: { companyId } } } }, { number: { startsWith: 'GARMENT-' } }] }
    });
    console.log(`📓 Total Journal Entries: ${journalsCount} (Opening + Drawings + GRNVs + PURVs)`);

    // Sample check for Accrued Liability
    const accruedAcc = await prisma.account.findFirst({ where: { companyId, code: '2200' } });
    if (accruedAcc) {
        const balance = await prisma.journalLine.aggregate({
            where: { accountId: accruedAcc.id },
            _sum: { debit: true, credit: true }
        });
        const bal = (balance._sum.credit?.toNumber() || 0) - (balance._sum.debit?.toNumber() || 0);
        console.log(`💰 Accrued Liability Balance: $${bal.toLocaleString()} (Pending invoices for 15 GRNs)`);
    }
}

async function run() {
    try {
        await verify('garments-company-1');
    } catch (e) {
        console.error("❌ Verification Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
