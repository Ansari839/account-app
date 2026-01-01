import 'dotenv/config';
import { PrismaClient, AccountType, VoucherType } from '@/app/generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
    console.log("👗 Refining Garments Business Foundation (V2)...");
    const CID = 'garments-company-1';

    try {
        // --- 1. Basic Setup ---
        await prisma.company.upsert({
            where: { id: CID },
            update: { name: 'Stitch & Style Garments Ltd' },
            create: { id: CID, name: 'Stitch & Style Garments Ltd', address: 'Garment Zone, Karachi', email: 'factory@stitchstyle.com' }
        });

        let fy = await prisma.financialYear.findFirst({ where: { name: "FY 2025-26" } });
        if (!fy) {
            fy = await prisma.financialYear.create({
                data: { id: 'fy-2025-garments', name: "FY 2025-26", startDate: new Date("2025-04-01"), endDate: new Date("2026-03-31"), isOpen: true }
            });
        }

        const passwordHash = await bcrypt.hash('Stitch@123', 10);
        await prisma.user.upsert({
            where: { email: 'garments@stitchstyle.com' },
            update: { companyId: CID },
            create: { id: 'garments-user-1', email: 'garments@stitchstyle.com', passwordHash, fullName: 'Garments Admin', companyId: CID, isActive: true, mustChangePass: false }
        });

        // --- 2. Advanced Cleanup & COA ---
        console.log("🗂️ Cleaning up & Seeding Professional COA...");

        // --- CLEANUP ---
        const entriesToDelete = await prisma.journalEntry.findMany({
            where: { OR: [{ lines: { some: { account: { companyId: CID } } } }, { number: { startsWith: 'GARMENT-' } }] },
            select: { id: true }
        });
        await prisma.journalLine.deleteMany({ where: { account: { companyId: CID } } });
        if (entriesToDelete.length > 0) { await prisma.journalEntry.deleteMany({ where: { id: { in: entriesToDelete.map(e => e.id) } } }); }

        await prisma.purchaseInvoiceItem.deleteMany({ where: { invoice: { invoiceNo: { startsWith: 'GARMENT-' } } } });
        await prisma.purchaseInvoice.deleteMany({ where: { invoiceNo: { startsWith: 'GARMENT-' } } });
        await prisma.salesInvoiceItem.deleteMany({ where: { invoice: { invoiceNo: { startsWith: 'GARMENT-' } } } });
        await prisma.salesInvoice.deleteMany({ where: { invoiceNo: { startsWith: 'GARMENT-' } } });
        await prisma.deliveryOrderItem.deleteMany({ where: { do: { doNo: { startsWith: 'GARMENT-' } } } });
        await prisma.deliveryOrder.deleteMany({ where: { doNo: { startsWith: 'GARMENT-' } } });
        await prisma.salesOrderItem.deleteMany({ where: { order: { orderNo: { startsWith: 'GARMENT-' } } } });
        await prisma.salesOrder.deleteMany({ where: { orderNo: { startsWith: 'GARMENT-' } } });
        await prisma.salesQuotationItem.deleteMany({ where: { quote: { quoteNo: { startsWith: 'GARMENT-' } } } });
        await prisma.salesQuotation.deleteMany({ where: { quoteNo: { startsWith: 'GARMENT-' } } });
        await prisma.gRNItem.deleteMany({ where: { grn: { grnNo: { startsWith: 'GARMENT-' } } } });
        await prisma.gRN.deleteMany({ where: { grnNo: { startsWith: 'GARMENT-' } } });
        await prisma.purchaseOrderItem.deleteMany({ where: { po: { poNo: { startsWith: 'GARMENT-' } } } });
        await prisma.purchaseOrder.deleteMany({ where: { poNo: { startsWith: 'GARMENT-' } } });
        await prisma.stockLedger.deleteMany({ where: { refId: { startsWith: 'GARMENT-' } } });

        await prisma.account.deleteMany({ where: { companyId: CID } });

        // --- NEW COA FOUNDATION ---
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

        // --- 3. Masters ---
        console.log("🛠️ Seeding Masters (Categories, Products, Suppliers)...");
        const mtr = await prisma.unit.upsert({ where: { code: 'MTR' }, update: {}, create: { code: 'MTR', name: 'Meters' } });
        const pcs = await prisma.unit.upsert({ where: { code: 'PCS' }, update: {}, create: { code: 'PCS', name: 'Pieces' } });
        const rmWh = await prisma.warehouse.upsert({ where: { code: 'RM-WH' }, update: {}, create: { code: 'RM-WH', name: 'Raw Material Store' } });

        const catApparel = await prisma.category.upsert({ where: { id: 'cat-garments-apparel' }, update: {}, create: { id: 'cat-garments-apparel', name: 'Apparel' } });
        const catFabrics = await prisma.category.upsert({ where: { id: 'cat-garments-fabrics' }, update: {}, create: { id: 'cat-garments-fabrics', name: 'Fabrics' } });
        const subMen = await prisma.category.upsert({ where: { id: 'cat-garments-men' }, update: {}, create: { id: 'cat-garments-men', name: 'Men\'s Wear', parentId: catApparel.id } });
        const subWoven = await prisma.category.upsert({ where: { id: 'cat-garments-woven' }, update: {}, create: { id: 'cat-garments-woven', name: 'Woven Fabrics', parentId: catFabrics.id } });

        const suppliers = [];
        for (let i = 1; i <= 5; i++) {
            suppliers.push(await prisma.supplier.upsert({
                where: { code: `GSUPP-0${i}` }, update: {},
                create: { code: `GSUPP-0${i}`, name: `Garment Supplier ${i}`, currencyCode: 'USD', payableAccountId: accMap['2100'] }
            }));
        }

        const products = [];
        for (let i = 1; i <= 25; i++) {
            products.push(await prisma.product.upsert({
                where: { code: `GPROD-${i.toString().padStart(3, '0')}` }, update: {},
                create: {
                    code: `GPROD-${i.toString().padStart(3, '0')}`, name: `Garment Item ${i}`,
                    categoryId: i <= 10 ? subWoven.id : subMen.id, baseUnitId: i <= 10 ? mtr.id : pcs.id,
                    inventoryAccountId: accMap['1210'], salesAccountId: accMap['4100'], cogsAccountId: accMap['5100'], purchaseAccountId: accMap['1210']
                }
            }));
        }

        // --- 4. Workflow Transactions ---
        console.log("🧾 Posting Transactional Workflow...");

        // A. Capital injection & Drawings
        await prisma.journalEntry.create({
            data: {
                number: 'GARMENT-JV-001', date: new Date('2025-04-01'), type: 'OPENING', financialYearId: fy.id,
                lines: { create: [{ accountId: accMap['1110'], debit: 1000000 }, { accountId: accMap['3100'], credit: 1000000 }] }
            }
        });
        await prisma.journalEntry.create({
            data: {
                number: 'GARMENT-JV-002', date: new Date('2025-05-01'), type: 'JOURNAL', narration: 'Owner Drawings for Personal Use', financialYearId: fy.id,
                lines: { create: [{ accountId: accMap['3200'], debit: 5000 }, { accountId: accMap['1110'], credit: 5000 }] }
            }
        });

        // B. 25 Purchase Orders -> GRNs -> PIs
        for (let i = 1; i <= 25; i++) {
            const supplier = suppliers[(i - 1) % 5];
            const product = products[(i - 1) % 25];
            const qty = 100 + i;
            const rate = 10 + i;
            const total = qty * rate;
            const date = new Date(2026, 0, 1 + (i % 30));

            // PO
            const po = await prisma.purchaseOrder.create({
                data: { poNo: `GARMENT-PO-${i.toString().padStart(3, '0')}`, supplierId: supplier.id, warehouseId: rmWh.id, date, totalAmount: total, items: { create: [{ productId: product.id, qty, rate, total }] } }
            });

            // GRN + Accounting (Inventory Dr / Accrued Liability Cr)
            const grnDate = new Date(date); grnDate.setDate(grnDate.getDate() + 2);
            const grn = await prisma.gRN.create({
                data: { grnNo: `GARMENT-GRN-${i.toString().padStart(3, '0')}`, poId: po.id, supplierId: supplier.id, warehouseId: rmWh.id, date: grnDate, items: { create: [{ productId: product.id, qtyReceived: qty }] } }
            });
            await prisma.stockLedger.create({ data: { productId: product.id, warehouseId: rmWh.id, date: grnDate, qtyIn: qty, refType: 'GRN', refId: grn.id } });

            // Transaction-wise Accounting for Receiving Items
            await prisma.journalEntry.create({
                data: {
                    number: `GARMENT-GRNV-${i.toString().padStart(3, '0')}`, date: grnDate, type: 'JOURNAL', reference: grn.grnNo, narration: `Inventory Received for ${po.poNo}`, financialYearId: fy.id,
                    lines: { create: [{ accountId: accMap['1210'], debit: total }, { accountId: accMap['2200'], credit: total }] }
                }
            });

            // 10 POs with Invoices (5 Cash, 5 Credit)
            if (i <= 10) {
                const piDate = new Date(grnDate); piDate.setDate(piDate.getDate() + 1);
                const isCash = i <= 5;
                const pi = await prisma.purchaseInvoice.create({
                    data: { invoiceNo: `GARMENT-PI-${i.toString().padStart(3, '0')}`, supplierId: supplier.id, date: piDate, totalAmount: total, grnId: grn.id, items: { create: [{ productId: product.id, qty, rate, total }] } }
                });

                // PI Accounting (Accrued Liability Dr / Cash or Payable Cr)
                await prisma.journalEntry.create({
                    data: {
                        number: `GARMENT-PURV-${i.toString().padStart(3, '0')}`, date: piDate, type: isCash ? 'PAYMENT' : 'PURCHASE', reference: pi.invoiceNo, narration: `Invoice Settlement for ${grn.grnNo} (${isCash ? 'Cash' : 'Credit'})`, financialYearId: fy.id,
                        lines: {
                            create: [
                                { accountId: accMap['2200'], debit: total },
                                { accountId: isCash ? accMap['1100'] : accMap['2100'], credit: total }
                            ]
                        }
                    }
                });
            }
        }

        console.log("\n🎉 Refined Garments Seeding Finished!");
    } catch (e) { console.error("❌ Failed:", e); } finally { await prisma.$disconnect(); }
}

seed();
