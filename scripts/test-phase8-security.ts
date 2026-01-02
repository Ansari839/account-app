import 'dotenv/config';
import { UserService } from "../services/user.service";
import { RoleService } from "../services/role.service";
import { ABACService } from "../services/abac.service";
import { AuditService } from "../services/audit.service";
import { JournalService } from "../services/journal.service";
import { AccountService } from "../services/account.service";
import { FinancialYearService } from "../services/financial-year.service";
import { AccountType, VoucherType } from "@/app/generated/prisma/client";
import prisma from "../lib/prisma";

async function runTest() {
    console.log("🚀 Starting Phase 8 Security & Admin Verification...");

    try {
        // 1. Cleanup
        await prisma.auditLog.deleteMany({});
        await prisma.userRoleLimit.deleteMany({});
        await prisma.userRole.deleteMany({});
        await prisma.role.deleteMany({});
        await prisma.user.deleteMany({});
        await prisma.journalLine.deleteMany({});
        await prisma.journalEntry.deleteMany({});
        await prisma.account.deleteMany({});

        // 2. Setup Base Data
        const adminRole = await RoleService.upsertRole("ADMIN", "Principal Administrator");
        const user = await UserService.createUser({
            email: "test@example.com",
            fullName: "Test User",
            roles: [adminRole.id]
        });
        console.log("✅ User Created:", user.email, "MustChangePass:", user.mustChangePass);

        // 3. Test Password Change
        await UserService.changePassword(user.id, "NewSecurePass123!");
        const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
        console.log("✅ Password Changed. MustChangePass:", updatedUser?.mustChangePass);

        // 4. Test ABAC Limits
        console.log("--- Testing ABAC Amount Limits ---");
        await prisma.userRoleLimit.create({
            data: {
                userId: user.id,
                module: "JOURNAL",
                limitType: "AMOUNT",
                limitValue: "1000"
            }
        });

        const bank = await AccountService.createAccount({ name: "Bank", type: AccountType.ASSET, isPosting: true });
        const sales = await AccountService.createAccount({ name: "Sales", type: AccountType.INCOME, isPosting: true });
        await FinancialYearService.createYear({ name: "FY 2025", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") });

        // Case A: Within Limit (500 < 1000)
        console.log("   Case A: Posting 500 (Limit 1000)...");
        await JournalService.createEntry({
            userId: user.id,
            date: new Date("2025-01-01"),
            type: VoucherType.JOURNAL,
            lines: [{ accountId: bank.id, debit: 500 }, { accountId: sales.id, credit: 500 }]
        });
        console.log("   ✅ Success.");

        // Case B: Over Limit (1500 > 1000)
        console.log("   Case B: Posting 1500 (Limit 1000)...");
        try {
            await JournalService.createEntry({
                userId: user.id,
                date: new Date("2025-01-02"),
                type: VoucherType.JOURNAL,
                lines: [{ accountId: bank.id, debit: 1500 }, { accountId: sales.id, credit: 1500 }]
            });
            console.error("   ❌ Error: Should have been blocked!");
        } catch (e: any) {
            console.log("   ✅ Correctly Blocked:", e.message);
        }

        // 5. Verify Audit Logs
        console.log("--- Verifying Audit Logs ---");
        const logs = await AuditService.getLogs("JOURNAL");
        console.log(`📜 Found ${logs.length} audit logs for JOURNAL module.`);
        if (logs.length > 0) {
            console.log("   Last Action:", logs[0].action, "by User:", logs[0].user?.email);
        }

        console.log("\n🎉 Phase 8 Security & Admin Verification Complete!");

    } catch (error) {
        console.error("❌ Test Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
