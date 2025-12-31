import 'dotenv/config';
import { FinancialYearService } from "../services/financialYear.service";
import { VoucherService } from "../services/voucher.service";
import { JournalService } from "../services/journal.service";
import { AccountService } from "../services/account.service";
import { AccountType, VoucherType } from "@/app/generated/prisma/client";
import prisma from "../lib/prisma";

async function runTest() {
    console.log("🚀 Starting Accounting Core Verification...");

    try {
        // 0. Cleanup
        console.log("--- Cleaning up ---");
        await prisma.journalLine.deleteMany({});
        await prisma.journalEntry.deleteMany({});
        await prisma.financialYear.deleteMany({});
        await prisma.voucherSequence.deleteMany({});
        await prisma.account.deleteMany({});

        // 1. Setup Financial Year
        console.log("--- Setting up Financial Year ---");
        const fy = await FinancialYearService.createYear({
            name: "FY 2024-25",
            startDate: new Date("2024-01-01"),
            endDate: new Date("2024-12-31")
        });
        console.log("✅ Created FY:", fy.name);

        // 2. Setup Accounts
        console.log("--- Setting up Accounts ---");
        const bank = await AccountService.createAccount({
            name: "HBL Bank",
            type: AccountType.ASSET,
            isPosting: true
        });
        const sales = await AccountService.createAccount({
            name: "Sales Revenue",
            type: AccountType.INCOME,
            isPosting: true
        });

        // 3. Test Auto-Vouchering (Journal)
        console.log("--- Testing Auto-Vouchering (JV) ---");
        const jv = await JournalService.createEntry({
            date: new Date("2024-06-01"),
            type: VoucherType.JOURNAL,
            narration: "Test JV",
            lines: [
                { accountId: bank.id, debit: 1000 },
                { accountId: sales.id, credit: 1000 }
            ]
        });
        console.log("✅ JV Created with Auto-No:", jv.number);

        // 4. Test Auto-Vouchering (Receipt)
        console.log("--- Testing Auto-Vouchering (RV) ---");
        const rv = await JournalService.createEntry({
            date: new Date("2024-06-02"),
            type: VoucherType.RECEIPT,
            narration: "Test RV",
            lines: [
                { accountId: bank.id, debit: 500 },
                { accountId: sales.id, credit: 500 }
            ]
        });
        console.log("✅ RV Created with Auto-No:", rv.number);

        // 5. Test Manual Number Override
        console.log("--- Testing Manual Number Override ---");
        const manualJV = await JournalService.createEntry({
            number: "MANUAL-001",
            date: new Date("2024-06-03"),
            type: VoucherType.JOURNAL,
            lines: [
                { accountId: bank.id, debit: 200 },
                { accountId: sales.id, credit: 200 }
            ]
        });
        console.log("✅ Manual JV Created:", manualJV.number);

        // 6. Test Year Lock Validation
        console.log("--- Testing Year Lock Validation ---");
        await FinancialYearService.closeYear(fy.id);
        console.log("🔒 FY Closed.");

        try {
            await JournalService.createEntry({
                date: new Date("2024-06-04"),
                type: VoucherType.JOURNAL,
                lines: [
                    { accountId: bank.id, debit: 100 },
                    { accountId: sales.id, credit: 100 }
                ]
            });
            console.error("❌ Error: Journal Entry should have failed for closed year!");
        } catch (e: any) {
            console.log("✅ Correctly blocked posting to closed year:", e.message);
        }

        console.log("\n🎉 Accounting Core Verification Complete!");

    } catch (error) {
        console.error("❌ Test Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
