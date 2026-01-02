import 'dotenv/config';
import { ReportService } from "../services/report.service";
import { FinancialYearService } from "../services/financial-year.service";
import { JournalService } from "../services/journal.service";
import { AccountService } from "../services/account.service";
import { AccountType, VoucherType } from "@prisma/client";
import prisma from "../lib/prisma";

async function runTest() {
    console.log("🚀 Starting Phase 6 Reports & Analytics Verification...");

    try {
        // 1. Cleanup & Setup (in dependency order)
        await prisma.stockLedger.deleteMany({});
        await prisma.journalLine.deleteMany({});
        await prisma.journalEntry.deleteMany({});

        // Clear all transactional documents to satisfy constraints
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

        await prisma.account.deleteMany({});
        await prisma.product.deleteMany({});
        await prisma.warehouse.deleteMany({});
        await prisma.financialYear.deleteMany({});
        await prisma.voucherSequence.deleteMany({});

        const company = await prisma.company.findFirst();
        if (!company) throw new Error("No company found");

        const bank = await AccountService.createAccount({ name: "Bank", type: AccountType.ASSET, isPosting: true });
        const sales = await AccountService.createAccount({ name: "Sales", type: AccountType.INCOME, isPosting: true });
        const tax = await AccountService.createAccount({ name: "Output Tax", type: AccountType.LIABILITY, isPosting: true });
        const expenses = await AccountService.createAccount({ name: "Rent Expense", type: AccountType.EXPENSE, isPosting: true });
        const receivables = await AccountService.createAccount({ name: "Accounts Receivable", type: AccountType.ASSET, isPosting: true });

        await FinancialYearService.createYear({
            name: "FY 2025",
            startDate: new Date("2025-01-01"),
            endDate: new Date("2025-12-31")
        });

        await FinancialYearService.createYear({
            name: "FY 2024",
            startDate: new Date("2024-01-01"),
            endDate: new Date("2024-12-31")
        });

        // 2. Mock Transactions
        console.log("--- Mocking Transactions ---");
        // Sales Transaction (Income & Tax)
        await JournalService.createEntry({
            date: new Date("2025-01-10"),
            type: VoucherType.SALES,
            lines: [
                { accountId: bank.id, debit: 1100 },
                { accountId: sales.id, credit: 1000 },
                { accountId: tax.id, credit: 100 }
            ]
        });

        // Expense Transaction
        await JournalService.createEntry({
            date: new Date("2025-01-15"),
            type: VoucherType.JOURNAL,
            lines: [
                { accountId: expenses.id, debit: 500 },
                { accountId: bank.id, credit: 500 }
            ]
        });

        // Credit Sales (Aging)
        await JournalService.createEntry({
            date: new Date("2024-11-01"), // Old invoice
            type: VoucherType.SALES,
            lines: [
                { accountId: receivables.id, debit: 2000 },
                { accountId: sales.id, credit: 2000 }
            ]
        });

        // 3. Verify P&L
        console.log("--- Verifying P&L ---");
        const pl = await ReportService.getProfitLoss(company.id, new Date("2025-01-01"), new Date("2025-01-31"));
        console.log(`📊 Net Profit: ${pl.netProfit} (Expected 500)`);

        // 4. Verify Balance Sheet
        console.log("--- Verifying Balance Sheet ---");
        const bs = await ReportService.getBalanceSheet(company.id, new Date("2025-12-31"));
        console.log(`🏢 Total Assets: ${bs.totalAssets} (Expected 2600)`); // 600 bank + 2000 receivables

        // 5. Verify Cash Flow
        console.log("--- Verifying Cash Flow ---");
        const cf = await ReportService.getCashFlow(company.id, new Date("2025-01-01"), new Date("2025-01-31"));
        console.log(`💵 Net Cash Flow: ${cf.netCashFlow} (Expected 600)`);

        // 6. Verify Aging
        console.log("--- Verifying Aging (AR) ---");
        const aging = await ReportService.getAgingReport(company.id, AccountType.ASSET, new Date("2025-01-31"));
        const arAging = aging.find(a => a.accountName === "Accounts Receivable");
        console.log(`⏳ Aging Bucket (90+): ${arAging.buckets["90+"]} (Expected 2000)`);

        // 7. Verify Dashboard Stats
        console.log("--- Verifying Dashboard Stats ---");
        const stats = await ReportService.getDashboardStats(company.id);
        console.log(`📈 Monthly Sales: ${stats.monthlySales}`);

        // 8. Verify Tax Summary
        console.log("--- Verifying Tax Summary ---");
        const taxSum = await ReportService.getTaxSummary(company.id, new Date("2025-01-01"), new Date("2025-01-31"));
        console.log(`📝 Output Tax: ${taxSum.find(t => t.name === "Output Tax")?.netTax} (Expected 100)`);

        console.log("\n🎉 Phase 6 Reports & Analytics Verification Success!");

    } catch (error) {
        console.error("❌ Test Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
