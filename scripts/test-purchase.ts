import 'dotenv/config';
import { AccountService } from "../services/account.service";
import { PartyService } from "../services/party.service";
import { ProductService } from "../services/product.service";
import { WarehouseService } from "../services/warehouse.service";
import { PurchaseService } from "../services/purchase.service";
import { JournalService } from "../services/journal.service";
import prisma from "../lib/prisma";
import { AccountType } from "@/app/generated/prisma/client";

async function runTest() {
    console.log("🚀 Starting Purchase Module Verification...");

    try {
        // 0. Cleanup Old Test Data
        console.log("--- Cleaning up Old Test Data ---");
        await prisma.stockLedger.deleteMany({});
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
        await prisma.supplier.deleteMany({});
        await prisma.category.deleteMany({});

        // We might want to keep some accounts but for a clean test we'll handle upsert or delete
        // Note: deleting accounts might fail if linked to other things. 
        // For this test, let's just use deleteMany on related tables first.

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

        // Accounts (Using upsert or find/create)
        const getAccount = async (code: string, name: string, type: AccountType, isPosting: boolean, parentId?: string) => {
            const existing = await prisma.account.findFirst({ where: { code } });
            if (existing) return existing;
            return await AccountService.createAccount({ name, type, isPosting, parentId });
        };

        const assets = await getAccount("1000", "Assets", AccountType.ASSET, false);
        const bank = await getAccount("1001", "HBL Bank", AccountType.ASSET, true, assets.id);
        const inventory = await getAccount("1002", "Inventory", AccountType.ASSET, true, assets.id);

        const liabilities = await getAccount("2000", "Liabilities", AccountType.LIABILITY, false);
        const ap = await getAccount("2001", "Accounts Payable", AccountType.LIABILITY, true, liabilities.id);
        const vatInput = await getAccount("2002", "Input VAT", AccountType.LIABILITY, true, liabilities.id);

        const expenses = await getAccount("4000", "Expenses", AccountType.EXPENSE, false);
        const cogs = await getAccount("4001", "COGS", AccountType.EXPENSE, true, expenses.id);

        // Tax (Ensure it has accountId)
        const vat5 = await prisma.taxCode.upsert({
            where: { code: "VAT5" },
            update: { accountId: vatInput.id },
            create: { name: "VAT 5%", code: "VAT5", rate: 5, accountId: vatInput.id }
        });

        // Supplier
        const supplier = await PartyService.createSupplier({
            code: "SUP-001",
            name: "Tech Solutions",
            currencyCode: "PKR",
            payableAccountId: ap.id
        });

        // Warehouse
        // Check if WH exists or deleteMany at top
        await prisma.warehouse.deleteMany({});
        const wh = await WarehouseService.createWarehouse({
            code: "WH-KHI",
            name: "Karachi Central",
            isDefault: true
        });

        // Product
        const laptop = await ProductService.createProduct({
            code: "LAP-001",
            name: "Dell XPS 15",
            baseUnitId: unitEach.id,
            categoryId: catElectronics.id,
            inventoryAccountId: inventory.id,
            cogsAccountId: cogs.id,
            purchaseAccountId: inventory.id, // Usually same as inventory for trading
            taxCodeId: vat5.id
        });

        // 2. Purchase Request
        console.log("--- Testing Purchase Request ---");
        const pr = await PurchaseService.createRequest({
            reqNo: "PR-2024-001",
            date: new Date(),
            items: [{ productId: laptop.id, qty: 10, description: "For dev team" }]
        });
        console.log("✅ Purchase Request Created:", pr.reqNo);

        // 3. Purchase Order
        console.log("--- Testing Purchase Order ---");
        const po = await PurchaseService.createPO({
            poNo: "PO-2024-001",
            supplierId: supplier.id,
            warehouseId: wh.id,
            date: new Date(),
            items: [{ productId: laptop.id, qty: 10, rate: 100000, taxCodeId: vat5.id }]
        });
        console.log("✅ Purchase Order Created:", po.poNo, "Total:", po.totalAmount.toString());

        // 4. GRN
        console.log("--- Testing GRN (Stock Impact) ---");
        const grn = await PurchaseService.createGRN({
            grnNo: "GRN-2024-001",
            poId: po.id,
            supplierId: supplier.id,
            warehouseId: wh.id,
            date: new Date(),
            items: [{ productId: laptop.id, qtyReceived: 10, poItemId: po.items[0].id }]
        });
        console.log("✅ GRN Created:", grn.grnNo);

        // Verify Stock Ledger
        const stock = await prisma.stockLedger.findFirst({ where: { refId: grn.id } });
        console.log("📦 Stock Ledger Entry:", stock ? `Qty In: ${stock.qtyIn}` : "NOT FOUND");

        // 5. Purchase Invoice
        console.log("--- Testing Purchase Invoice (Accounting Impact) ---");
        const invoice = await PurchaseService.createPurchaseInvoice({
            invoiceNo: "INV-SUP-12345",
            supplierId: supplier.id,
            date: new Date(),
            grnId: grn.id,
            poId: po.id,
            items: [{ productId: laptop.id, qty: 10, rate: 100000, taxCodeId: vat5.id }]
        });
        console.log("✅ Purchase Invoice Created:", invoice.invoiceNo, "Total:", invoice.totalAmount.toString());

        // Verify Journal Entry
        if (invoice.journalEntryId) {
            const jv = await JournalService.getEntryByNumber((await prisma.journalEntry.findUnique({ where: { id: invoice.journalEntryId } }))?.number || "");
            console.log("📜 Auto JV Generated:", jv?.number);
            jv?.lines.forEach(line => {
                console.log(`   Account: ${line.account.name} | DR: ${line.debit} | CR: ${line.credit}`);
            });
        }

        // 6. Purchase Return
        console.log("--- Testing Purchase Return ---");
        const prt = await PurchaseService.createReturn({
            purchaseInvoiceId: invoice.id,
            date: new Date(),
            remarks: "Faulty unit",
            items: [{ productId: laptop.id, qty: 1, rate: 100000 }]
        });
        console.log("✅ Purchase Return Processed:", prt.success ? "Success" : "Failed", "Amount:", prt.amount);

        console.log("\n🎉 Purchase Module Verification Complete!");

    } catch (error) {
        console.error("❌ Test Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
