
import 'dotenv/config';
import prisma from "../lib/prisma";
import { SalesService } from "../services/sales.service";
import { ProductService } from "../services/product.service";
import { WarehouseService } from "../services/warehouse.service";
import { AccountType } from "@prisma/client";

async function runVerification() {
    console.log("🚀 Starting Sales Module Verification (using tsx)...");

    try {
        // 0. Environment Setup
        const company = await prisma.company.findFirst() || await prisma.company.create({ data: { name: "Test Corp" } });
        const companyId = company.id;

        // 1. Setup Test Data
        console.log("--- Setup Master Data ---");

        // Ensure default warehouse
        const wh = await prisma.warehouse.findFirst({ where: { code: "WH-VERIFY" } }) || await WarehouseService.createWarehouse({
            code: "WH-VERIFY",
            name: "Verification Warehouse",
            isDefault: false
        });

        // Ensure accounts
        const getOrCreateAccount = async (code: string, name: string, type: AccountType, isPosting: boolean, parentId?: string) => {
            const existing = await prisma.account.findFirst({ where: { code, companyId } });
            if (existing) return existing;
            return await prisma.account.create({
                data: { code, name, type, isPosting, parentId, companyId }
            });
        };

        const assets = await getOrCreateAccount("1000", "Assets", AccountType.ASSET, false);
        const bank = await getOrCreateAccount("1001", "Test Bank", AccountType.ASSET, true, assets.id);
        const inventory = await getOrCreateAccount("1002", "Test Inventory", AccountType.ASSET, true, assets.id);
        const salesAccount = await getOrCreateAccount("3001", "Test Sales", AccountType.INCOME, true);
        const cogsAccount = await getOrCreateAccount("4001", "Test COGS", AccountType.EXPENSE, true);

        // Ensure category and unit
        const cat = await prisma.category.findFirst() || await prisma.category.create({ data: { name: "General" } });
        const unit = await prisma.unit.findFirst({ where: { code: "EA" } }) || await prisma.unit.create({ data: { code: "EA", name: "Each" } });

        // Ensure Product with account mappings
        const product = await ProductService.createProduct({
            code: "VERIFY-P1",
            name: "Verification Product",
            baseUnitId: unit.id,
            categoryId: cat.id,
            inventoryAccountId: inventory.id,
            cogsAccountId: cogsAccount.id,
            salesAccountId: salesAccount.id,
            costRate: 100
        }).catch(async () => {
            return prisma.product.update({
                where: { code: "VERIFY-P1" },
                data: { inventoryAccountId: inventory.id, cogsAccountId: cogsAccount.id, salesAccountId: salesAccount.id }
            });
        });

        // Seed stock to allow sale
        await prisma.stockLedger.create({
            data: {
                productId: product.id,
                warehouseId: wh.id,
                date: new Date(),
                qtyIn: 100,
                qtyOut: 0,
                costRate: 80,
                refType: "OPENING",
                refId: "SEED"
            }
        });

        // Helper to mimic SalesController.resolveCustomerId
        const resolveCustomerId = async (id: string) => {
            const account = await prisma.account.findUnique({ where: { id } });
            if (!account) return id;
            let customer = await prisma.customer.findFirst({ where: { receivableAccountId: account.id } });
            if (!customer) {
                const lastCustomer = await prisma.customer.findFirst({ where: { code: { startsWith: 'CUST-' } }, orderBy: { code: 'desc' } });
                let nextSeq = 1;
                if (lastCustomer) {
                    const lastNum = parseInt(lastCustomer.code.split('-')[1]);
                    if (!isNaN(lastNum)) nextSeq = lastNum + 1;
                }
                customer = await prisma.customer.create({
                    data: {
                        code: `CUST-${nextSeq.toString().padStart(4, '0')}`,
                        name: `Cash Customer - ${account.name}`,
                        receivableAccountId: account.id,
                        currencyCode: 'PKR'
                    }
                });
            }
            return customer.id;
        };

        // 2. Test "Simple Game" Auto-Link (Resolving Account to Customer)
        console.log("--- Testing 'Auto-Link' Logic ---");
        const customerId = await resolveCustomerId(bank.id);

        const so = await SalesService.createOrder({
            // orderNo omitted to test auto-gen
            customerId: customerId,
            warehouseId: wh.id,
            date: new Date(),
            items: [{ productId: product.id, qty: 5, rate: 120 }]
        });
        console.log("✅ Sales Order Created:", so.orderNo);

        // Verify Customer was created
        const customer = await prisma.customer.findFirst({
            where: { receivableAccountId: bank.id }
        });
        console.log("   -> Auto-created Customer:", customer?.name, "Code:", customer?.code);

        // 3. Test Full Flow
        console.log("--- Testing Full Flow: SO -> DO -> SI ---");

        // DO
        const doNote = await SalesService.createDO({
            // doNo omitted to test auto-gen
            orderId: so.id,
            customerId: customerId,
            warehouseId: wh.id,
            date: new Date(),
            items: [{ productId: product.id, qtyShipped: 5, orderItemId: so.items[0].id }]
        });
        console.log("✅ Delivery Order Created:", doNote.doNo);

        // SI (Invoice)
        const si = await SalesService.createSalesInvoice({
            // invoiceNo omitted to test auto-gen
            customerId: customerId,
            doId: doNote.id,
            date: new Date(),
            items: [{ productId: product.id, qty: 5, rate: 120 }]
        });
        console.log("✅ Sales Invoice Created:", si.invoiceNo, "Total:", si.totalAmount.toString());

        // Verify Journal Entry
        if (si.journalEntryId) {
            const jv = await prisma.journalEntry.findUnique({
                where: { id: si.journalEntryId },
                include: { lines: { include: { account: true } } }
            });
            console.log("📜 Journal Entry Generated:", jv?.number);
            jv?.lines.forEach(line => {
                console.log(`   [${line.account.name}] DR: ${line.debit} | CR: ${line.credit}`);
            });
        }

        console.log("\n🎉 Sales Module Verification Success!");

    } catch (error) {
        console.error("❌ Verification Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runVerification();
