import 'dotenv/config';
import { PrismaClient, AccountType, VoucherType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
    console.log("🚀 Starting DEEP Business Seeding...");
    const CID = 'trial-company-1';

    try {
        // --- 1. Basic Setup (Company, FY, User) ---
        const company = await prisma.company.upsert({
            where: { id: CID },
            update: { name: 'Global Trade Solutions Ltd' },
            create: { id: CID, name: 'Global Trade Solutions Ltd', address: '45 Export Ave, Dubai', email: 'info@globaltrade.com' }
        });

        const fy = await prisma.financialYear.upsert({
            where: { id: 'fy-2025-trial' },
            update: { isOpen: true, endDate: new Date("2026-03-31") },
            create: { id: 'fy-2025-trial', name: "FY 2025-26", startDate: new Date("2025-04-01"), endDate: new Date("2026-03-31"), isOpen: true }
        });

        const passwordHash = await bcrypt.hash('Trial@123', 10);
        await prisma.user.upsert({
            where: { email: 'trial@globaltrade.com' },
            update: { companyId: CID },
            create: { id: 'trial-user-1', email: 'trial@globaltrade.com', passwordHash, fullName: 'Trial Admin', companyId: CID, isActive: true, mustChangePass: false }
        });

        // --- 2. Advanced COA ---
        console.log("🗂️ Seeding COA...");
        // Find entries that have lines in this company and delete them
        const entriesToDelete = await prisma.journalEntry.findMany({
            where: {
                OR: [
                    { lines: { some: { account: { companyId: CID } } } },
                    { number: { startsWith: 'TRIAL-' } }
                ]
            },
            select: { id: true }
        });

        await prisma.journalLine.deleteMany({ where: { account: { companyId: CID } } });

        if (entriesToDelete.length > 0) {
            await prisma.journalEntry.deleteMany({ where: { id: { in: entriesToDelete.map(e => e.id) } } });
        }

        await prisma.account.deleteMany({ where: { companyId: CID } });

        const coa = [
            { code: '1000', name: 'ASSETS', type: 'ASSET', isPosting: false },
            { code: '1100', name: 'Fixed Assets', type: 'ASSET', parentCode: '1000' },
            { code: '1210', name: 'Inventory Stock', type: 'ASSET', parentCode: '1000' },
            { code: '1220', name: 'Accounts Receivable', type: 'ASSET', parentCode: '1000' },
            { code: '1231', name: 'Meezan Islamic Bank', type: 'ASSET', parentCode: '1000' },
            { code: '2000', name: 'LIABILITIES', type: 'LIABILITY', isPosting: false },
            { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', parentCode: '2000' },
            { code: '3000', name: 'EQUITY', type: 'EQUITY', isPosting: false },
            { code: '3100', name: 'Owner Investment', type: 'EQUITY', parentCode: '3000' },
            { code: '4000', name: 'INCOME', type: 'INCOME', isPosting: false },
            { code: '4100', name: 'Product Sales', type: 'INCOME', parentCode: '4000' },
            { code: '5000', name: 'EXPENSES', type: 'EXPENSE', isPosting: false },
            { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', parentCode: '5000' },
            { code: '5210', name: 'Office Rent', type: 'EXPENSE', parentCode: '5000' },
        ];

        const accMap: Record<string, string> = {};
        for (const ac of coa) {
            const pId = ac.parentCode ? accMap[ac.parentCode] : null;
            const account = await prisma.account.create({
                data: { code: ac.code, name: ac.name, type: ac.type as any, isPosting: ac.isPosting !== false, parentId: pId, companyId: CID, level: pId ? 1 : 0 }
            });
            accMap[ac.code] = account.id;
        }

        // --- 3. Prerequisites & Master Data ---
        console.log("🛠️ Seeding Masters...");
        const usd = await prisma.currency.upsert({ where: { code: 'USD' }, update: {}, create: { code: 'USD', name: 'USD', symbol: '$', isBase: true, rate: 1 } });
        const vat15 = await prisma.taxCode.upsert({ where: { code: 'VAT15' }, update: {}, create: { code: 'VAT15', name: 'VAT 15%', rate: 15 } });
        const pcs = await prisma.unit.upsert({ where: { code: 'PCS' }, update: {}, create: { code: 'PCS', name: 'Pieces' } });
        const mwh = await prisma.warehouse.upsert({ where: { code: 'MWH' }, update: {}, create: { code: 'MWH', name: 'Main Warehouse', isDefault: true } });

        const prod = await prisma.product.upsert({
            where: { code: 'LAP-001' }, update: {},
            create: { code: 'LAP-001', name: 'iPhone 15 Pro', baseUnitId: pcs.id, inventoryAccountId: accMap['1210'], salesAccountId: accMap['4100'], cogsAccountId: accMap['5100'], purchaseAccountId: accMap['1210'] }
        });

        const cust = await prisma.customer.upsert({
            where: { code: 'CUST-01' }, update: {},
            create: { code: 'CUST-01', name: 'Al-Futtaim Tech', currencyCode: 'USD', receivableAccountId: accMap['1220'] }
        });

        const supp = await prisma.supplier.upsert({
            where: { code: 'SUPP-01' }, update: {},
            create: { code: 'SUPP-01', name: 'Apple Wholesale', currencyCode: 'USD', payableAccountId: accMap['2100'] }
        });

        // --- 4. Workflow Transactions ---
        console.log("🧾 Posting Workflow...");

        // A. Opening Journal
        await prisma.journalEntry.create({
            data: {
                number: 'TRIAL-JV-001', date: new Date('2025-04-01'), type: 'OPENING', financialYearId: fy.id,
                lines: { create: [{ accountId: accMap['1231'], debit: 100000 }, { accountId: accMap['3100'], credit: 100000 }] }
            }
        });

        // B. Purchase Workflow (PO -> GRN -> PI)
        const po = await prisma.purchaseOrder.create({
            data: {
                poNo: 'TRIAL-PO-001', supplierId: supp.id, warehouseId: mwh.id, date: new Date('2026-01-05'), totalAmount: 5000,
                items: { create: [{ productId: prod.id, qty: 5, rate: 1000, total: 5000 }] }
            }
        });

        const grn = await prisma.gRN.create({
            data: {
                grnNo: 'TRIAL-GRN-001', poId: po.id, supplierId: supp.id, warehouseId: mwh.id, date: new Date('2026-01-08'),
                items: { create: [{ productId: prod.id, qtyReceived: 5 }] }
            }
        });
        await prisma.stockLedger.create({ data: { productId: prod.id, warehouseId: mwh.id, date: grn.date, qtyIn: 5, refType: 'GRN', refId: grn.id } });

        const pi = await prisma.purchaseInvoice.create({
            data: {
                invoiceNo: 'TRIAL-PI-001', supplierId: supp.id, date: new Date('2026-01-10'), totalAmount: 5000, grnId: grn.id,
                items: { create: [{ productId: prod.id, qty: 5, rate: 1000, total: 5000 }] }
            }
        });
        await prisma.journalEntry.create({
            data: {
                number: 'TRIAL-PURV-001', date: pi.date, type: 'PURCHASE', reference: pi.invoiceNo, financialYearId: fy.id,
                lines: { create: [{ accountId: accMap['1210'], debit: 5000 }, { accountId: accMap['2100'], credit: 5000 }] }
            }
        });

        // C. Sales Workflow (Quote -> Order -> DO -> SI)
        const quote = await prisma.salesQuotation.create({
            data: { quoteNo: 'TRIAL-QO-001', customerId: cust.id, date: new Date('2026-01-15'), totalAmount: 7500, items: { create: [{ productId: prod.id, qty: 5, rate: 1500, total: 7500 }] } }
        });

        const order = await prisma.salesOrder.create({
            data: { orderNo: 'TRIAL-SO-001', customerId: cust.id, quoteId: quote.id, date: new Date('2026-01-16'), totalAmount: 7500, items: { create: [{ productId: prod.id, qty: 5, rate: 1500, total: 7500 }] } }
        });

        const do_doc = await prisma.deliveryOrder.create({
            data: { doNo: 'TRIAL-DO-001', orderId: order.id, customerId: cust.id, warehouseId: mwh.id, date: new Date('2026-01-18'), items: { create: [{ productId: prod.id, qty: 5 }] } }
        });
        await prisma.stockLedger.create({ data: { productId: prod.id, warehouseId: mwh.id, date: do_doc.date, qtyOut: 5, refType: 'DO', refId: do_doc.id } });

        const si = await prisma.salesInvoice.create({
            data: {
                invoiceNo: 'TRIAL-SI-001', customerId: cust.id, date: new Date('2026-01-20'), totalAmount: 7500, doId: do_doc.id,
                items: { create: [{ productId: prod.id, qty: 5, rate: 1500, total: 7500 }] }
            }
        });
        await prisma.journalEntry.create({
            data: {
                number: 'TRIAL-SALV-001', date: si.date, type: 'SALES', reference: si.invoiceNo, financialYearId: fy.id,
                lines: {
                    create: [
                        { accountId: accMap['1220'], debit: 7500 }, { accountId: accMap['4100'], credit: 7500 },
                        { accountId: accMap['5100'], debit: 5000 }, { accountId: accMap['1210'], credit: 5000 }
                    ]
                }
            }
        });

        // D. Payments & Receipts
        await prisma.journalEntry.create({
            data: {
                number: 'TRIAL-PV-001', date: new Date('2026-01-22'), type: 'PAYMENT', financialYearId: fy.id,
                lines: { create: [{ accountId: accMap['2100'], debit: 5000 }, { accountId: accMap['1231'], credit: 5000 }] }
            }
        });

        await prisma.journalEntry.create({
            data: {
                number: 'TRIAL-RV-001', date: new Date('2026-01-25'), type: 'RECEIPT', financialYearId: fy.id,
                lines: { create: [{ accountId: accMap['1231'], debit: 7500 }, { accountId: accMap['1220'], credit: 7500 }] }
            }
        });

        console.log("\n🎉 Deep Seeding Finished!");
    } catch (e) { console.error("❌ Failed:", e); } finally { await prisma.$disconnect(); }
}

seed();
