
require('ts-node').register({
    transpileOnly: true, // Skip type checking for speed and preventing '2322' errors
    compilerOptions: {
        module: 'commonjs' // Force CJS
    }
});
require('dotenv').config();

const { SalesService } = require('../services/sales.service');
const { WarehouseService } = require('../services/warehouse.service');
const { ProductService } = require('../services/product.service');
const prisma = require('../lib/prisma').default; // Check if default export or named
const { AccountType } = require('@prisma/client');

async function runTest() {
    console.log("🚀 Starting Sales Module Verification (CJS Mode)...");

    try {
        // 0. Cleanup
        console.log("--- Cleaning up ---");
        // Safe delete (reverse order of dependency)
        await prisma.stockLedger.deleteMany({});
        await prisma.salesReturnItem.deleteMany({});
        await prisma.salesReturn.deleteMany({});
        await prisma.salesInvoiceItem.deleteMany({});
        await prisma.salesInvoice.deleteMany({});
        await prisma.deliveryOrderItem.deleteMany({});
        await prisma.deliveryOrder.deleteMany({});
        await prisma.salesOrderItem.deleteMany({});
        await prisma.salesOrder.deleteMany({});

        // 1. Setup Data
        console.log("--- Setup ---");

        // Ensure Warehouse
        const wh = await prisma.warehouse.upsert({
            where: { code: "WH-TEST" },
            update: {},
            create: { code: "WH-TEST", name: "Test Warehouse", isDefault: true }
        });

        // Ensure Product
        const cat = await prisma.category.findFirst() || await prisma.category.create({ data: { name: "Test Cat" } });
        const unit = await prisma.unit.findFirst() || await prisma.unit.create({ data: { code: "EA", name: "Each" } });

        // Accounts
        const assets = await prisma.account.findFirst({ where: { code: "1000" } });
        const inventory = await prisma.account.upsert({
            where: { code: "1002" },
            update: {},
            create: { code: "1002", name: "Inv", type: "ASSET", isPosting: true, parentId: assets?.id }
        });
        const cogs = await prisma.account.upsert({
            where: { code: "4001" },
            update: {},
            create: { code: "4001", name: "COGS", type: "EXPENSE", isPosting: true }
        });
        const sales = await prisma.account.upsert({
            where: { code: "3001" },
            update: {},
            create: { code: "3001", name: "Sales", type: "INCOME", isPosting: true }
        });
        // Receivable/Cash Account
        const cash = await prisma.account.upsert({
            where: { code: "1001" },
            update: {},
            create: { code: "1001", name: "Cash on Hand", type: "ASSET", isPosting: true, parentId: assets?.id }
        });

        const product = await prisma.product.upsert({
            where: { code: "TEST-PROD" },
            update: { inventoryAccountId: inventory.id, cogsAccountId: cogs.id, salesAccountId: sales.id },
            create: {
                code: "TEST-PROD",
                name: "Test Product",
                baseUnitId: unit.id,
                categoryId: cat.id,
                inventoryAccountId: inventory.id,
                cogsAccountId: cogs.id,
                salesAccountId: sales.id
            }
        });

        // Seed Stock
        await prisma.stockLedger.create({
            data: {
                productId: product.id,
                warehouseId: wh.id,
                date: new Date(),
                qtyIn: 100,
                qtyOut: 0,
                costRate: 100,
                refType: "OPENING",
                refId: "init"
            }
        });

        // 2. Test Auto-Link
        console.log("--- Testing Auto-Link with Account ID: " + cash.id);

        // Simulating: Controller resolved ID and passed it to Service. 
        // Note: Controller calculates 'customer.id' from 'account.id' using `resolveCustomerId`.
        // BUT Service `createOrder` expects `customerId`. 
        // If we pass `account.id` to Service, does Service `resolveCustomer` handle it?
        // YES! My `SalesService.resolveCustomer` rewrite Step 3: "Fall back: Check if 'id' is actually an Account ID".
        // So passing account.id SHOULD work.

        const so = await SalesService.createOrder({
            orderNo: "SO-CJS-001",
            customerId: cash.id, // Passing Account ID
            warehouseId: wh.id,
            date: new Date(),
            items: [{ productId: product.id, qty: 1, rate: 150 }]
        });
        console.log("✅ SO Created:", so.orderNo);

        const don = await SalesService.createDO({
            doNo: "DO-CJS-001",
            orderId: so.id,
            customerId: cash.id,
            warehouseId: wh.id,
            date: new Date(),
            items: [{ productId: product.id, qtyShipped: 1 }]
        });
        console.log("✅ DO Created:", don.doNo);

        const inv = await SalesService.createSalesInvoice({
            invoiceNo: "SI-CJS-001",
            customerId: cash.id,
            warehouseId: wh.id,
            date: new Date(),
            doId: don.id,
            items: [{ productId: product.id, qty: 1, rate: 150 }]
        });
        console.log("✅ SI Created:", inv.invoiceNo, "Total:", inv.totalAmount);

        if (inv.journalEntryId) {
            console.log("✅ JV Linked:", inv.journalEntryId);
        } else {
            console.error("❌ JV Missing!");
        }

        const sr = await SalesService.createSalesReturn({
            customerId: cash.id,
            invoiceId: inv.id,
            warehouseId: wh.id,
            date: new Date(),
            items: [{ productId: product.id, qty: 1, rate: 150 }]
        });
        console.log("✅ SR Created:", sr.returnNo);

    } catch (e) {
        console.error("❌ Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
