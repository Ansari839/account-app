import 'dotenv/config';
import { FinancialYearService } from "../services/financialYear.service";
import { JournalService } from "../services/journal.service";
import { AccountService } from "../services/account.service";
import { ReportService } from "../services/report.service";
import { GlobalSettingsService } from "../services/settings.service";
import { AccountType, VoucherType } from "@/app/generated/prisma/client";
import prisma from "../lib/prisma";

async function runTest() {
    console.log("🚀 Starting Accounting Reports & Controls Verification...");

    try {
        // 0. Cleanup
        await prisma.journalLine.deleteMany({});
        await prisma.journalEntry.deleteMany({});
        await prisma.financialYear.deleteMany({});
        await prisma.voucherSequence.deleteMany({});
        await prisma.account.deleteMany({});
        await prisma.globalSetting.deleteMany({});

        // 1. Setup FY
        const fy = await FinancialYearService.createYear({
            name: "FY 2024",
            startDate: new Date("2024-01-01"),
            endDate: new Date("2024-12-31")
        });

        // 2. Setup Accounts
        const bank = await AccountService.createAccount({ name: "Bank", type: AccountType.ASSET, isPosting: true });
        const sales = await AccountService.createAccount({ name: "Sales", type: AccountType.INCOME, isPosting: true });

        // 3. Post Transactions
        console.log("--- Posting Transactions ---");
        await JournalService.createEntry({
            date: new Date("2024-05-01"),
            type: VoucherType.JOURNAL,
            lines: [
                { accountId: bank.id, debit: 5000 },
                { accountId: sales.id, credit: 5000 }
            ]
        });

        await JournalService.createEntry({
            date: new Date("2024-05-15"),
            type: VoucherType.JOURNAL,
            lines: [
                { accountId: bank.id, debit: 2000 },
                { accountId: sales.id, credit: 2000 }
            ]
        });

        // 4. Test Trial Balance
        console.log("--- Testing Trial Balance ---");
        const tb = await ReportService.getTrialBalance(new Date("2024-12-31"));
        console.log("📊 Trial Balance Result:");
        tb.forEach(r => console.log(`   ${r.accountName} | DR: ${r.debit} | CR: ${r.credit}`));

        // 5. Test Ledger
        console.log("--- Testing Ledger (Bank) ---");
        const ledger = await ReportService.getLedger(bank.id, new Date("2024-05-01"), new Date("2024-05-31"));
        console.log(`📖 Bank Ledger Transactions: ${ledger.transactions.length}`);

        // 6. Test Date Lock Control
        console.log("--- Testing Date Lock Control ---");
        await prisma.globalSetting.create({
            data: { key: "FINANCE_LOCK_DATE", value: "2024-04-30", type: "STRING" }
        });

        // This should pass (May 1st > April 30th)
        console.log("   Attempting post on 2024-05-20 (Post-Lock)...");
        await JournalService.createEntry({
            date: new Date("2024-05-20"),
            type: VoucherType.JOURNAL,
            lines: [{ accountId: bank.id, debit: 100 }, { accountId: sales.id, credit: 100 }]
        });
        console.log("   ✅ Success.");

        // This should fail (April 1st < April 30th)
        console.log("   Attempting post on 2024-04-01 (Pre-Lock)...");
        try {
            await JournalService.createEntry({
                date: new Date("2024-04-01"),
                type: VoucherType.JOURNAL,
                lines: [{ accountId: bank.id, debit: 100 }, { accountId: sales.id, credit: 100 }]
            });
            console.error("   ❌ Error: Should have failed due to date lock!");
        } catch (e: any) {
            console.log("   ✅ Correctly blocked:", e.message);
        }

        console.log("\n🎉 Accounting Reports & Controls Verification Complete!");

    } catch (error) {
        console.error("❌ Test Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
