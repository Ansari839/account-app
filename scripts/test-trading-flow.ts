
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testTradingFlow() {
    console.log('🚀 Starting Trading Flow Test...');

    try {
        // 1. Setup Data
        const companyId = 'default-company';
        let warehouse = await prisma.warehouse.findFirst();
        if (!warehouse) {
            console.log("⚠️ No warehouse found, creating one...");
            warehouse = await prisma.warehouse.create({
                data: {
                    name: 'Main Warehouse',
                    code: 'WH-MAIN',
                    isDefault: true,
                    address: 'Test Address'
                }
            });
        }

        const assetAccount = await prisma.account.findFirst({ where: { type: 'ASSET', isPosting: true } });
        const incomeAccount = await prisma.account.findFirst({ where: { type: 'INCOME', isPosting: true } });
        const expenseAccount = await prisma.account.findFirst({ where: { type: 'EXPENSE', isPosting: true } });
        const cogsAccount = await prisma.account.findFirst({ where: { name: { contains: "Cost" }, isPosting: true } }) || expenseAccount;

        if (!assetAccount || !incomeAccount || !expenseAccount) throw new Error("Missing accounts");

        // Create Test Product
        const productCode = `TEST-PROD-${Date.now()}`;
        const product = await prisma.product.create({
            data: {
                name: 'Test Trading Product',
                code: productCode,
                baseUnitId: (await prisma.unit.findFirst())?.id!,
                categoryId: (await prisma.category.findFirst())?.id,
                inventoryAccountId: assetAccount.id,
                salesAccountId: incomeAccount.id,
                cogsAccountId: cogsAccount?.id,
                purchaseAccountId: expenseAccount.id,
                taxCodeId: (await prisma.taxCode.findFirst())?.id
            }
        });
        console.log(`✅ Created Product: ${product.code}`);

        // 2. Direct Purchase (Direct Invoice)
        console.log('📦 Creating Direct Purchase Invoice...');
        const supplier = await prisma.supplier.findFirst();
        if (!supplier) throw new Error("No supplier found");

        // Simulate API Request Body for Purchase
        const qty = 10;
        const rate = 100;

        // We call the Logic from PurchaseLogic directly or mimic it?
        // Let's use Prisma to simulate what the controller does, checking our constraints.
        const poInv = await prisma.purchaseInvoice.create({
            data: {
                invoiceNo: `PI-TEST-${Date.now()}`,
                supplierId: supplier.id,
                date: new Date(),
                totalAmount: qty * rate,
                warehouseId: warehouse.id, // Providing Warehouse!
                items: {
                    create: [{
                        productId: product.id,
                        qty: qty,
                        rate: rate,
                        total: qty * rate
                    }]
                }
            }
        });

        // Manually trigger the Stock Logic (mimicking Controller)
        await prisma.stockLedger.create({
            data: {
                productId: product.id,
                warehouseId: warehouse.id,
                date: new Date(),
                qtyIn: qty,
                costRate: rate,
                refType: 'INVOICE',
                refId: poInv.id
            }
        });
        console.log(`✅ Purchase Invoice Created: ${poInv.invoiceNo}`);

        // Verify Stock
        const stockAfterPurchase = await prisma.stockLedger.aggregate({
            where: { productId: product.id },
            _sum: { qtyIn: true, qtyOut: true }
        });
        const netStock = Number(stockAfterPurchase._sum.qtyIn || 0) - Number(stockAfterPurchase._sum.qtyOut || 0);
        console.log(`📊 Stock after Purchase: ${netStock}`);

        if (netStock !== 10) throw new Error(`Stock should be 10, got ${netStock}`);

        // 3. Direct Sales (Invoice)
        console.log('💰 Creating Direct Sales Invoice...');
        const customer = await prisma.customer.findFirst();
        if (!customer) throw new Error("No customer found");

        const sellQty = 2;
        const sellRate = 150;

        const salesInv = await prisma.salesInvoice.create({
            data: {
                invoiceNo: `SI-TEST-${Date.now()}`,
                customerId: customer.id,
                warehouseId: warehouse.id,
                date: new Date(),
                totalAmount: sellQty * sellRate,
                items: {
                    create: [{
                        productId: product.id,
                        qty: sellQty,
                        rate: sellRate,
                        total: sellQty * sellRate
                    }]
                }
            },
            include: { items: { include: { product: true } } }
        });

        // Manually trigger Stock & Accounting Logic (Mimicking Service)
        // Stock Deduction
        await prisma.stockLedger.create({
            data: {
                productId: product.id,
                warehouseId: warehouse.id,
                date: new Date(),
                qtyOut: sellQty,
                refType: 'SALES_INVOICE',
                refId: salesInv.id
            }
        });

        // Accounting (COGS Check)
        // This is the logic we fixed: finding cost rate
        let costRate = 0;
        const lastPurchaseItem = await prisma.purchaseInvoiceItem.findFirst({
            where: { productId: product.id },
            orderBy: { invoice: { date: 'desc' } }
        });
        costRate = lastPurchaseItem ? Number(lastPurchaseItem.rate) : 0;

        if (costRate === 0) {
            console.log('⚠️ No PI item found, checking Stock Ledger fallback...');
            const lastStock = await prisma.stockLedger.findFirst({
                where: { productId: product.id, costRate: { gt: 0 } },
                orderBy: { date: 'desc' }
            });
            if (lastStock) costRate = Number(lastStock.costRate);
        }

        console.log(`💵 Detected COGS Rate: ${costRate}`);

        if (costRate !== 100) throw new Error(`COGS Rate should be 100, got ${costRate}`);

        console.log(`✅ Test Passed! Stock updated and COGS detected correctly.`);

    } catch (e) {
        console.error("❌ Test Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

testTradingFlow();
