import 'dotenv/config';
import { FinancialYearService } from "../services/financialYear.service";
import { JournalService } from "../services/journal.service";
import { AccountService } from "../services/account.service";
import { ClosingService } from "../services/closing.service";
import { AccountType, VoucherType } from "@/app/generated/prisma/client";
import prisma from "../lib/prisma";

async function runTest() {
    console.log("🚀 Starting Year-End Closing Verification...");

    try {
        // 0. Cleanup
        await prisma.journalLine.deleteMany({});
        await prisma.journalEntry.deleteMany({});
        await prisma.financialYear.deleteMany({});
        await prisma.voucherSequence.deleteMany({});
        await prisma.account.deleteMany({});

        // 1. Setup Accounts
        const assets = await AccountService.createAccount({ code: "1000", name: "Assets", type: AccountType.ASSET, isPosting: false });
        const bank = await AccountService.createAccount({ code: "1001", name: "Bank", type: AccountType.ASSET, isPosting: true, parentId: assets.id });

        const income = await AccountService.createAccount({ code: "3000", name: "Income", type: AccountType.INCOME, isPosting: false });
        const sales = await AccountService.createAccount({ code: "3001", name: "Sales", type: AccountType.INCOME, isPosting: true, parentId: income.id });

        const expense = await AccountService.createAccount({ code: "4000", name: "Expense", type: AccountType.EXPENSE, isPosting: false });
        const rent = await AccountService.createAccount({ code: "4001", name: "Rent", type: AccountType.EXPENSE, isPosting: true, parentId: expense.id });

        const equity = await AccountService.createAccount({ code: "5000", name: "Equity", type: AccountType.EQUITY, isPosting: false });
        const pnl = await AccountService.createAccount({ code: "5001", name: "P&L Summary", type: AccountType.EQUITY, isPosting: true, parentId: equity.id });
        const retainedEarnings = await AccountService.createAccount({ code: "5002", name: "Retained Earnings", type: AccountType.EQUITY, isPosting: true, parentId: equity.id });

        // 2. Setup Year 1
        const fy1 = await FinancialYearService.createYear({
            name: "FY 2023",
            startDate: new Date("2023-01-01"),
            endDate: new Date("2023-12-31")
        });

        // 3. Post Transactions in Year 1
        console.log("--- Posting Transactions in Year 1 ---");
        await JournalService.createEntry({
            date: new Date("2023-06-01"),
            type: VoucherType.JOURNAL,
            lines: [
                { accountId: bank.id, debit: 10000 },
                { accountId: sales.id, credit: 10000 }
            ]
        });

        await JournalService.createEntry({
            date: new Date("2023-07-01"),
            type: VoucherType.JOURNAL,
            lines: [
                { accountId: rent.id, debit: 3000 },
                { accountId: bank.id, credit: 3000 }
            ]
        });
        // Year 1 Balances: Bank (7000 DR), Sales (10000 CR), Rent (3000 DR) -> Profit 7000

        // 4. Close Year 1
        console.log("--- Closing Year 1 ---");
        const closingResult = await ClosingService.performYearClosing(fy1.id, new Date("2023-12-31"), pnl.id, retainedEarnings.id);
        console.log("✅ Year 1 Closed. Profit:", closingResult.netProfit);

        // 5. Setup Year 2
        const fy2 = await FinancialYearService.createYear({
            name: "FY 2024",
            startDate: new Date("2024-01-01"),
            endDate: new Date("2024-12-31")
        });

        // 6. Carry Forward to Year 2
        console.log("--- Carry Forward to Year 2 ---");
        const openingJV = await ClosingService.carryForwardBalances(fy1.id, fy2.id, new Date("2024-01-01"));
        console.log("✅ Opening JV Created in Year 2:", openingJV?.number);
        openingJV?.lines.forEach(l => {
            console.log(`   Account: ${l.accountId} | DR: ${l.debit} | CR: ${l.credit}`);
        });

        // 7. Verify Bank Opening Balance in Year 2
        const bankLines = await prisma.journalLine.findMany({
            where: { accountId: bank.id, entry: { financialYearId: fy2.id } }
        });
        console.log("📦 Bank Opening Balance in FY2:", bankLines[0]?.debit.toString());

        console.log("\n🎉 Year-End Closing Verification Complete!");

    } catch (error) {
        console.error("❌ Test Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
