
// @ts-nocheck
import 'dotenv/config';
import { AccountService } from "../services/account.service.js";
import { PartyService } from "../services/party.service.js";
import { ProductService } from "../services/product.service.js";
import { WarehouseService } from "../services/warehouse.service.js";
import { SalesService } from "../services/sales.service.js";
import { JournalService } from "../services/journal.service.js";
import prisma from "../lib/prisma.js";
import { AccountType } from "@prisma/client";

// Mock global for API imports in Service (path unavailable in script)
// Services might import fs/path which is fine in node script.

async function runTest() {
    console.log("🚀 Starting Sales Module Verification...");

    const userCompanyId = "default-company"; // Simulate auth context if needed?
    // Services mostly don't check auth except controller.

    try {
        // 0. Cleanup Old Test Data
        console.log("--- Cleaning up Old Test Data (Sales) ---");
        await prisma.stockLedger.deleteMany({});
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

        // Also clean Purchase to ensure clear Stock
        await prisma.purchaseInvoiceItem.deleteMany({});
        await prisma.purchaseInvoice.deleteMany({});
        await prisma.stockLedger.deleteMany({});

        // 1. Setup Master Data
        console.log("--- Setting up Master Data ---");

        // Currencies
        const pkr = await prisma.currency.upsert({
            where: { code: "PKR" },
            update: {},
            create: { code: "PKR", name: "Pakistani Rupee", symbol: "Rs" }
        });

        // Units
        const unitEach = await prisma.unit.upsert({
            where: { code: "EA" },
            update: {},
            create: { code: "EA", name: "Each" }
        });

        // Category
        const catElectronics = await prisma.category.upsert({
            where: { name: "Electronics" },
            update: {},
            create: { name: "Electronics" }
        });

        // Accounts
        const getAccount = async (code: string, name: string, type: AccountType, isPosting: boolean, parentId?: string) => {
            return await prisma.account.upsert({
                where: { code },
                update: { isPosting, name, type, parentId },
                create: { code, name, type, isPosting, parentId }
            });
        };

        const assets = await getAccount("1000", "Assets", AccountType.ASSET, false);
        const bank = await getAccount("1001", "HBL Bank", AccountType.ASSET, true, assets.id);
        const inventory = await getAccount("1002", "Inventory", AccountType.ASSET, true, assets.id);
        const receivables = await getAccount("1003", "Accounts Receivable", AccountType.ASSET, true, assets.id); // For registered cust

        const revenue = await getAccount("3000", "Revenue", AccountType.INCOME, false);
        const sales = await getAccount("3001", "Sales Account", AccountType.INCOME, true, revenue.id);

        const expenses = await getAccount("4000", "Expenses", AccountType.EXPENSE, false);
        const cogs = await getAccount("4001", "COGS", AccountType.EXPENSE, true, expenses.id);

        const liabilities = await getAccount("2000", "Liabilities", AccountType.LIABILITY, false);
        const vatOutput = await getAccount("2005", "Output VAT", AccountType.LIABILITY, true, liabilities.id);

        // Tax
        const vat5 = await prisma.taxCode.upsert({
            where: { code: "VAT5" },
            update: { accountId: vatOutput.id },
            create: { name: "VAT 5%", code: "VAT5", rate: 5, accountId: vatOutput.id }
        });

        // Warehouse
        await prisma.warehouse.deleteMany({});
        const wh = await WarehouseService.createWarehouse({
            code: "WH-SALES",
            name: "Sales Warehouse",
            isDefault: true
        });

        // Product
        const phone = await ProductService.createProduct({
            code: "PH-001",
            name: "iPhone 15",
            baseUnitId: unitEach.id,
            categoryId: catElectronics.id,
            inventoryAccountId: inventory.id,
            cogsAccountId: cogs.id,
            salesAccountId: sales.id,
            taxCodeId: vat5.id,
            costRate: 100000 // Seed with cost helper logic or assume previous purchase
            // Service looks at StockLedger for cost if not provided. To simulate cost, let's inject a "Opening Balance" stock.
        });

        // Seed Stock (to allow sales)
        await prisma.stockLedger.create({
            data: {
                productId: phone.id,
                warehouseId: wh.id,
                date: new Date(),
                qtyIn: 100,
                qtyOut: 0,
                costRate: 150000,
                refType: "OPENING",
                refId: "seed-1"
            }
        });

        // 2. Test "Simple Game" Auto-Link (Resolving Cash Account to Customer)
        console.log("--- Testing 'Auto-Link' Logic (Using Bank Account ID directly) ---");

        // Emulate Controller Logic: Controller resolves ID before calling Service.
        // We need to test the Service's robustness OR the Controller's Helper.
        // Since we are running script, we don't have the Controller helper available directly unless exported.
        // But we modified Service to accept Account ID in `resolveCustomer` too! (Wait, did we?)
        // In my rewrite plan, I moved the Robustness to the Controller Helper `resolveCustomerId`, 
        // AND I also kept the `resolveCustomer` in Service as "Strict Lookup + Fallback".
        // Let's verify if Service handles it.

        // Attempt to create Order using BANK ACCOUNT ID as customerId
        // This relies on Service having the fallback logic I wrote.
        /* 
           Wait, looking at my last rewrite of SalesService, I implemented:
           // 3. Fallback: Check if 'id' is actually an Account ID...
           So Service IS robust!
        */

        const bankAccountId = bank.id;

        const so = await SalesService.createOrder({
            orderNo: "SO-AUTO-001",
            customerId: bankAccountId, // <--- MAGIC: Using Account ID directly
            warehouseId: wh.id,
            date: new Date(),
            items: [{ productId: phone.id, qty: 1, rate: 200000, taxCodeId: vat5.id }]
        });
        console.log("✅ Sales Order Created (Auto-Linked):", so.orderNo);

        // Verify Customer was created
        const linkedCustomer = await prisma.customer.findFirst({ where: { receivableAccountId: bankAccountId } });
        console.log("   -> Auto-Created Customer:", linkedCustomer?.name, linkedCustomer?.code);

        // 3. Delivery Order
        console.log("--- Testing Delivery Order ---");
        const don = await SalesService.createDO({
            doNo: "DO-AUTO-001",
            orderId: so.id,
            customerId: bankAccountId, // Use same ID
            warehouseId: wh.id,
            date: new Date(),
            items: [{ productId: phone.id, qtyShipped: 1, orderItemId: so.items[0].id }]
        });
        console.log("✅ Delivery Order Created:", don.doNo);

        // Verify Stock Out
        const stockOut = await prisma.stockLedger.findFirst({ where: { refId: don.id } });
        console.log("📦 Stock Out (DO):", stockOut ? `Qty Out: ${stockOut.qtyOut}` : "NOT FOUND");

        // 4. Sales Invoice
        console.log("--- Testing Sales Invoice ---");
        const inv = await SalesService.createSalesInvoice({
            invoiceNo: "SI-AUTO-001",
            customerId: bankAccountId,
            warehouseId: wh.id,
            date: new Date(),
            doId: don.id,
            items: [{ productId: phone.id, qty: 1, rate: 200000, taxCodeId: vat5.id }]
        });
        console.log("✅ Sales Invoice Created:", inv.invoiceNo, "Total:", inv.totalAmount.toString());

        // Verify Stock Ledger Update (DO -> Invoice)
        const updatedStock = await prisma.stockLedger.findFirst({ where: { refId: inv.id } });
        console.log("📦 Updated Stock Ledger (Invoice):", updatedStock ? "YES (Replaced DO)" : "NO (Failed)");

        // Verify Journal Entry
        if (inv.journalEntryId) {
            const jv = await JournalService.getEntryByNumber((await prisma.journalEntry.findUnique({ where: { id: inv.journalEntryId } }))?.number || "");
            console.log("📜 Auto JV Generated:", jv?.number);
            jv?.lines.forEach(line => {
                console.log(`   Account: ${line.account.name} | DR: ${line.debit} | CR: ${line.credit}`);
            });
            // Expect: 
            // DR Bank (Receivable Account)
            // CR Sales
            // CR Output VAT
            // DR COGS
            // CR Inventory
        }

        // 5. Sales Return
        console.log("--- Testing Sales Return ---");
        const sr = await SalesService.createSalesReturn({
            customerId: bankAccountId,
            invoiceId: inv.id,
            warehouseId: wh.id,
            date: new Date(),
            remarks: "Customer returned",
            items: [{ productId: phone.id, qty: 1, rate: 200000 }]
        });
        console.log("✅ Sales Return Created:", sr.returnNo);

        // Verify Stock In
        const stockIn = await prisma.stockLedger.findFirst({ where: { refId: sr.id } });
        console.log("📦 Stock In (Return):", stockIn ? `Qty In: ${stockIn.qtyIn}` : "NOT FOUND");

        console.log("\n🎉 Sales Module Verification Complete!");

    } catch (error) {
        console.error("❌ Test Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
