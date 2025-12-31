
import 'dotenv/config';
import { AccountType } from '../app/generated/prisma/client';
import { AccountService } from '../services/account.service';
import { PartyService } from '../services/party.service';
import { ProductService } from '../services/product.service';
import { WarehouseService } from '../services/warehouse.service';
import { UnitService } from '../services/unit.service';
import { TaxService } from '../services/tax.service';
import prisma from '../lib/prisma'; // Use singleton

async function main() {
    console.log('🧪 Starting Service Verification...');

    try {
        // 1. Test Create Root Account
        const root = await AccountService.createAccount({
            name: 'Test Assets',
            type: AccountType.ASSET,
            isPosting: false
        });
        console.log('✅ Created Root Account:', root.name);

        // 2. Test Create Child Account
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

        const canPostRoot = await AccountService.validatePostingAccount(root.id);
        if (!canPostRoot) console.log('✅ Summary Account Validation Passed (Cannot Post)');
        else console.error('❌ Summary Account Validation Failed');

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

        // 7. Warehouse Service
        const wh1 = await WarehouseService.createWarehouse({
            code: `WH-1-${Date.now()}`,
            name: 'Warehouse 1',
            isDefault: true
        });
        console.log('✅ Created Default Warehouse:', wh1.name);

        const wh2 = await WarehouseService.createWarehouse({
            code: `WH-2-${Date.now()}`,
            name: 'Warehouse 2',
            isDefault: true // Should override wh1
        });
        console.log('✅ Created New Default Warehouse:', wh2.name);

        const defaultWh = await WarehouseService.getDefaultWarehouse();
        if (defaultWh?.id === wh2.id) console.log('✅ Default Warehouse Override Passed');
        else console.error('❌ Default Warehouse Override Failed');

        // 8. Unit Service
        let kg = await prisma.unit.findFirst({ where: { code: 'KG' } });
        if (!kg) kg = await UnitService.createUnit({ name: 'Kilogram', code: 'KG' });

        let gm = await prisma.unit.findFirst({ where: { code: 'GM' } });
        if (!gm) gm = await UnitService.createUnit({ name: 'Gram', code: 'GM' });

        try {
            await UnitService.addConversion({ fromUnitId: kg.id, toUnitId: gm.id, factor: 1000 });
            console.log('✅ Added Conversion: KG -> GM (1000)');
        } catch (e) {
            console.log('ℹ️ Conversion might already exist or failed:', (e as Error).message);
        }

        // 9. Tax Service
        const vat5 = await TaxService.createTaxCode({ name: 'VAT 5%', code: `VAT5-${Date.now()}`, rate: 5.0 });
        console.log('✅ Created Tax Code:', vat5.name);

        try {
            await TaxService.createTaxCode({ name: 'Invalid Tax', code: 'INV', rate: -10 });
            console.error('❌ Failed to catch negative tax rate');
        } catch (e: any) {
            console.log('✅ Caught Negative Tax Rate Error:', e.message);
        }

        // 10. Product Service (Final Integrated Test)
        const prodCode = `PROD-${Date.now()}`;
        const product = await ProductService.createProduct({
            code: prodCode,
            name: 'Test Product',
            baseUnitId: kg.id,
            inventoryAccountId: child.id,
            salesAccountId: child.id,
            taxCodeId: vat5.id
        });
        console.log('✅ Created Product with Unit & Tax:', product.name);

        try {
            await ProductService.createProduct({
                code: `FAIL-PROD-${Date.now()}`,
                name: 'Fail Product',
                baseUnitId: kg.id,
                inventoryAccountId: root.id
            });
            console.error('❌ Failed to catch invalid product account');
        } catch (e: any) {
            console.log('✅ Caught Invalid Product Account Error:', e.message);
        }

    } catch (e) {
        console.error('❌ Service Test Failed:', e);
        process.exit(1);
    }
}

main();
