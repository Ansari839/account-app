import 'dotenv/config';
import { AccountService } from "../services/account.service";
import { PartyService } from "../services/party.service";
import { ProductService } from "../services/product.service";
import { WarehouseService } from "../services/warehouse.service";
import { SalesService } from "../services/sales.service";
import { PurchaseService } from "../services/purchase.service"; // Need this for costing (last purchase)
import { JournalService } from "../services/journal.service";
import prisma from "../lib/prisma";
import { AccountType } from "@/app/generated/prisma/client";

async function runTest() {
    console.log("🚀 Starting Sales Module Verification...");

    try {
        // 0. Cleanup Old Test Data
        console.log("--- Cleaning up Old Test Data ---");
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

        await prisma.purchaseInvoiceItem.deleteMany({});
        await prisma.purchaseInvoice.deleteMany({});
        await prisma.gRNItem.deleteMany({});
        await prisma.gRN.deleteMany({});
        await prisma.purchaseOrderItem.deleteMany({});
        await prisma.purchaseOrder.deleteMany({});
        await prisma.purchaseRequestItem.deleteMany({});
        await prisma.purchaseRequest.deleteMany({});

        await prisma.journalLine.deleteMany({});
        await prisma.journalEntry.deleteMany({});

        await prisma.product.deleteMany({});
        await prisma.customer.deleteMany({});
        await prisma.supplier.deleteMany({});
        await prisma.category.deleteMany({});

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
        const catElectronics = await prisma.category.create({
            data: { name: "Electronics" }
        });

        // Accounts
        const getAccount = async (code: string, name: string, type: AccountType, isPosting: boolean, parentId?: string) => {
            const existing = await prisma.account.findUnique({ where: { code } });
            if (existing) return existing;
            return await AccountService.createAccount({ name, type, isPosting, parentId });
        };

        const assets = await getAccount("1000", "Assets", AccountType.ASSET, false);
        const bank = await getAccount("1001", "HBL Bank", AccountType.ASSET, true, assets.id);
        const inventory = await getAccount("1002", "Inventory", AccountType.ASSET, true, assets.id);
        const ar = await getAccount("1003", "Accounts Receivable", AccountType.ASSET, true, assets.id);

        const liabilities = await getAccount("2000", "Liabilities", AccountType.LIABILITY, false);
        const ap = await getAccount("2001", "Accounts Payable", AccountType.LIABILITY, true, liabilities.id);
        const vatOutput = await getAccount("2003", "Output VAT", AccountType.LIABILITY, true, liabilities.id);

        const income = await getAccount("3000", "Income", AccountType.INCOME, false);
        const salesRevenue = await getAccount("3001", "Sales Revenue", AccountType.INCOME, true, income.id);

        const expenses = await getAccount("4000", "Expenses", AccountType.EXPENSE, false);
        const cogs = await getAccount("4001", "COGS", AccountType.EXPENSE, true, expenses.id);

        // Tax
        const vat10 = await prisma.taxCode.upsert({
            where: { code: "VAT10" },
            update: { accountId: vatOutput.id },
            create: { name: "VAT 10%", code: "VAT10", rate: 10, accountId: vatOutput.id }
        });

        // Customer
        const customer = await PartyService.createCustomer({
            code: "CUST-001",
            name: "John Doe",
            currencyCode: "PKR",
            receivableAccountId: ar.id
        });

        // Supplier (for setting up cost)
        const supplier = await PartyService.createSupplier({
            code: "SUP-002",
            name: "Mega Vendor",
            currencyCode: "PKR",
            payableAccountId: ap.id
        });

        // Warehouse
        await prisma.warehouse.deleteMany({});
        const wh = await WarehouseService.createWarehouse({
            code: "WH-MAI",
            name: "Main Stores",
            isDefault: true
        });

        // Product
        const phone = await ProductService.createProduct({
            code: "PHN-001",
            name: "iPhone 15 Pro",
            baseUnitId: unitEach.id,
            categoryId: catElectronics.id,
            inventoryAccountId: inventory.id,
            cogsAccountId: cogs.id,
            salesAccountId: salesRevenue.id,
            purchaseAccountId: inventory.id,
            taxCodeId: vat10.id
        });

        // 2. Setup Cost (Via Purchase)
        console.log("--- Setting up Product Cost (Purchase) ---");
        await PurchaseService.createPurchaseInvoice({
            invoiceNo: "PUR-INV-999",
            supplierId: supplier.id,
            date: new Date(),
            items: [{ productId: phone.id, qty: 100, rate: 200000, taxCodeId: vat10.id }] // Cost = 200k
        });

        // 3. Sales Quotation
        console.log("--- Testing Sales Quotation ---");
        const quote = await SalesService.createQuotation({
            quoteNo: "QT-2024-001",
            customerId: customer.id,
            date: new Date(),
            items: [{ productId: phone.id, qty: 5, rate: 250000, taxCodeId: vat10.id }]
        });
        console.log("✅ Quotation Created:", quote.quoteNo);

        // 4. Sales Order
        console.log("--- Testing Sales Order ---");
        const order = await SalesService.createOrder({
            orderNo: "SO-2024-001",
            customerId: customer.id,
            date: new Date(),
            quoteId: quote.id,
            items: [{ productId: phone.id, qty: 5, rate: 250000, taxCodeId: vat10.id }]
        });
        console.log("✅ Sales Order Created:", order.orderNo);

        // 5. Delivery Order
        console.log("--- Testing Delivery Order (Stock Impact) ---");
        const doDoc = await SalesService.createDO({
            doNo: "DO-2024-001",
            orderId: order.id,
            customerId: customer.id,
            warehouseId: wh.id,
            date: new Date(),
            items: [{ productId: phone.id, qtyShipped: 5, orderItemId: order.items[0].id }]
        });
        console.log("✅ DO Created:", doDoc.doNo);

        // Verify Stock
        const stock = await prisma.stockLedger.findFirst({ where: { refId: doDoc.id } });
        console.log("📦 Stock Ledger (Qty Out):", stock?.qtyOut.toString());

        // 6. Sales Invoice
        console.log("--- Testing Sales Invoice (Complex 5-line JV) ---");
        const invoice = await SalesService.createSalesInvoice({
            invoiceNo: "SINV-2024-001",
            customerId: customer.id,
            warehouseId: wh.id,
            doId: doDoc.id,
            date: new Date(),
            items: [{ productId: phone.id, qty: 5, rate: 250000, taxCodeId: vat10.id }]
        });
        console.log("✅ Sales Invoice Created:", invoice.invoiceNo, "Total:", invoice.totalAmount.toString());

        // Verify Journal Entry
        if (invoice.journalEntryId) {
            const jv = await JournalService.getEntryByNumber((await prisma.journalEntry.findUnique({ where: { id: invoice.journalEntryId } }))?.number || "");
            console.log("📜 Auto JV Generated (5 Lines expected):", jv?.number);
            jv?.lines.forEach(line => {
                console.log(`   Account: ${line.account.name} | DR: ${line.debit} | CR: ${line.credit}`);
            });
        }

        // 7. Sales Return
        console.log("--- Testing Sales Return ---");
        const srt = await SalesService.createSalesReturn({
            invoiceId: invoice.id,
            date: new Date(),
            remarks: "Customer changed mind",
            items: [{ productId: phone.id, qty: 1, rate: 250000 }]
        });
        console.log("✅ Sales Return Processed:", srt.success ? "Success" : "Failed");

        // Verify Return Stock
        const returnStock = await prisma.stockLedger.findFirst({ where: { refType: "SALES_RETURN", refId: srt.returnId } });
        console.log("📦 Stock Ledger (Qty In):", returnStock?.qtyIn.toString());

        console.log("\n🎉 Sales Module Verification Complete!");

    } catch (error) {
        console.error("❌ Test Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
