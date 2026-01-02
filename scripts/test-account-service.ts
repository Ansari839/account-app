
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, AccountType } from '@prisma/client';
import { AccountService } from '../services/account.service';
import { PartyService } from '../services/party.service';

// Initialize Prisma for the script (mocking the singleton for this context or using direct import if feasible)
// ... (comments) ...

async function main() {
    console.log('🧪 Starting Service Verification...');

    try {
        // 1. Test Create Root Account
        const rootCode = `TEST-ASSET-${Date.now()}`;
        const root = await AccountService.createAccount({
            name: 'Test Assets',
            type: AccountType.ASSET,
            isPosting: false
        });
        console.log('✅ Created Root Account:', root.name);

        // 2. Test Create Child Account
        const childCode = `TEST-BANK-${Date.now()}`;
        const child = await AccountService.createAccount({
            name: 'Test Bank',
            type: AccountType.ASSET,
            parentId: root.id,
            isPosting: true
        });
        console.log('✅ Created Child Account:', child.name);

        // 3. Test Hierarchy
        const tree = await AccountService.getAccountHierarchy();
        console.log('✅ Retrieved Hierarchy. Total Root Nodes:', tree.length);

        // 4. Test Validation
        const canPost = await AccountService.validatePostingAccount(child.id);
        if (canPost) console.log('✅ Posting Validation Passed');
        else console.error('❌ Posting Validation Failed');

        // 5. Party Service: Create Customer
        const custCode = `CUST-${Date.now()}`;
        const customer = await PartyService.createCustomer({
            code: custCode,
            name: 'Test Customer',
            currencyCode: 'USD',
            receivableAccountId: child.id
        });
        console.log('✅ Created Customer:', customer.name);

        // 6. Party Service: Fail on Summary Account
        try {
            await PartyService.createCustomer({
                code: `FAIL-${Date.now()}`,
                name: 'Fail Customer',
                currencyCode: 'USD',
                receivableAccountId: root.id // Summary account
            });
            console.error('❌ Failed to catch invalid account (Expected Error)');
        } catch (e: any) {
            console.log('✅ Caught Invalid Account Error:', e.message);
        }

    } catch (e) {
        console.error('❌ Service Test Failed:', e);
        process.exit(1);
    }
}

main();
