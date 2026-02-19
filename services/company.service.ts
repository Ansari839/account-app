import prisma from "@/lib/prisma";
import { FinancialYearService } from "./financial-year.service";
import { AccountType } from "@prisma/client";

export class CompanyService {
    /**
     * Create a new company
     */
    static async create(data: { name: string; email?: string; phone?: string; address?: string; website?: string }) {
        return await prisma.company.create({
            data
        });
    }

    /**
     * Clone an existing company (Master Data Only)
     */
    static async clone(sourceCompanyId: string, targetName: string, userId: string) {
        // 1. Get Source Company
        const source = await prisma.company.findUnique({
            where: { id: sourceCompanyId }
        });

        if (!source) throw new Error("Source company not found");

        // 2. Create Target Company
        const target = await prisma.company.create({
            data: {
                name: targetName,
                email: source.email,
                phone: source.phone,
                address: source.address,
                website: source.website,
                // Add Creator as Admin
                userCompanies: {
                    create: {
                        userId,
                        role: 'ADMIN',
                        isDefault: true
                    }
                }
            }
        });

        const targetId = target.id;

        // 3. Clone Settings
        const settings = await prisma.companySetting.findMany({ where: { companyId: sourceCompanyId } });
        if (settings.length) {
            await prisma.companySetting.createMany({
                data: settings.map(s => ({
                    companyId: targetId,
                    key: s.key,
                    value: s.value,
                    type: s.type,
                    group: s.group
                }))
            });
        }

        // 4. Clone Currencies
        const currencies = await prisma.currency.findMany({ where: { companyId: sourceCompanyId } });
        if (currencies.length) {
            await prisma.currency.createMany({
                data: currencies.map(c => ({
                    companyId: targetId,
                    code: c.code,
                    name: c.name,
                    symbol: c.symbol,
                    rate: c.rate,
                    isBase: c.isBase
                }))
            });
        }

        // 5. Clone Units
        // Note: Unit conversions might be tricky if IDs change. For now, just clone base units.
        const units = await prisma.unit.findMany({ where: { companyId: sourceCompanyId } });
        const unitMap = new Map<string, string>(); // OldId -> NewId

        for (const u of units) {
            const newUnit = await prisma.unit.create({
                data: {
                    companyId: targetId,
                    name: u.name,
                    code: u.code
                }
            });
            unitMap.set(u.id, newUnit.id);
        }

        // 6. Clone Tax Codes
        const taxes = await prisma.taxCode.findMany({ where: { companyId: sourceCompanyId } });
        for (const t of taxes) {
            await prisma.taxCode.create({
                data: {
                    companyId: targetId,
                    name: t.name,
                    code: t.code,
                    rate: t.rate
                }
            });
        }

        // 7. Clone Financial Year (Create a new open one based on current date, or copy source structure?)
        // Better to create a fresh FY for the current period.
        await FinancialYearService.createYear(targetId, {
            name: `FY-${new Date().getFullYear()}`,
            startDate: new Date(new Date().getFullYear(), 0, 1),
            endDate: new Date(new Date().getFullYear(), 11, 31)
        });

        // 8. Clone Chart of Accounts (The big one)
        // We need to maintain hierarchy.
        // Fetch source accounts ordered by level/hierarchy
        const accounts = await prisma.account.findMany({
            where: { companyId: sourceCompanyId },
            orderBy: { level: 'asc' } // Create parents first
        });

        const accountMap = new Map<string, string>(); // OldId -> NewId

        for (const acc of accounts) {
            // Find new parent ID if it exists
            const newParentId = acc.parentId ? accountMap.get(acc.parentId) : null;

            const newAcc = await prisma.account.create({
                data: {
                    companyId: targetId,
                    code: acc.code,
                    name: acc.name,
                    type: acc.type,
                    level: acc.level,
                    isPosting: acc.isPosting,
                    parentId: newParentId,
                    description: acc.description
                }
            });
            accountMap.set(acc.id, newAcc.id);
        }

        // 9. Clone Warehouses
        const warehouses = await prisma.warehouse.findMany({ where: { companyId: sourceCompanyId } });
        for (const w of warehouses) {
            await prisma.warehouse.create({
                data: {
                    companyId: targetId,
                    code: w.code,
                    name: w.name,
                    address: w.address,
                    isDefault: w.isDefault
                }
            });
        }

        // 10. Clone Categories
        const categories = await prisma.category.findMany({
            where: { companyId: sourceCompanyId },
            orderBy: { parentId: 'asc' } // A bit simplistic for hierarchy, but might work if nulls (roots) come first? No, nulls are usually first.
        });

        // Better to do 2 passes or use map like accounts.
        const catMap = new Map<string, string>();
        // Filter roots
        const roots = categories.filter(c => c.parentId === null);
        for (const r of roots) {
            const newCat = await prisma.category.create({
                data: { companyId: targetId, name: r.name }
            });
            catMap.set(r.id, newCat.id);
            // Process children recursively? Or just iterative if only 1-2 levels.
            // Let's do a simple iterative pass for children of these roots.
            const children = categories.filter(c => c.parentId === r.id);
            for (const child of children) {
                const newChild = await prisma.category.create({
                    data: { companyId: targetId, name: child.name, parentId: newCat.id }
                });
                catMap.set(child.id, newChild.id);
            }
        }

        return target;
    }
}
